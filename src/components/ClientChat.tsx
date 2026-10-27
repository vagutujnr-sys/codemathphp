import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  FileAudio,
  FileVideo,
  LoaderCircle,
  Mic,
  Paperclip,
  Phone,
  PhoneOff,
  Reply,
  Send,
  Square,
  UserRound,
  X,
} from "lucide-react";
import { NotificationPermissionButton } from "@/components/NotificationPermissionButton";
import {
  api,
  type ChatCallSignal,
  type Client,
  type ClientMessage,
  type InvoicingUser,
} from "@/lib/invoicing-api";

type Props = {
  clients: Client[];
  user: InvoicingUser;
  onBack: () => void;
};

type VoiceCall = {
  id: string;
  peer: RTCPeerConnection;
  localStream: MediaStream;
};

const sortMessages = (messages: ClientMessage[]) =>
  messages.sort((left, right) => left.created_at.localeCompare(right.created_at));

export function ClientChat({ clients, user, onBack }: Props) {
  const [selectedClientId, setSelectedClientId] = useState(
    user.role === "client" ? (user.client_id ?? "") : (clients[0]?.id ?? ""),
  );
  const clientId = user.role === "client" ? (user.client_id ?? "") : selectedClientId;
  const selectedClient = clients.find((client) => client.id === clientId);
  const contactName = user.role === "admin" ? (selectedClient?.name ?? "Client") : "CodeMath";
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ClientMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [error, setError] = useState("");
  const [callStatus, setCallStatus] = useState<"idle" | "dialing" | "connecting" | "connected">(
    "idle",
  );
  const [incomingOffer, setIncomingOffer] = useState<ChatCallSignal | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callRef = useRef<VoiceCall | null>(null);
  const callIdRef = useRef<string | null>(null);
  const callChannelRef = useRef<{
    send: (signal: ChatCallSignal) => Promise<void>;
    unsubscribe: () => void;
  } | null>(null);
  const incomingOfferRef = useRef<ChatCallSignal | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const earlyIceRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (user.role === "admin" && !clients.some((client) => client.id === selectedClientId)) {
      setSelectedClientId(clients[0]?.id ?? "");
    }
  }, [clients, selectedClientId, user.role]);

  useEffect(() => {
    let active = true;
    setMessages([]);
    setReplyTo(null);
    setError("");
    setLoading(Boolean(clientId));
    if (!clientId) {
      setLoading(false);
      return;
    }

    const addMessage = (message: ClientMessage) => {
      setMessages((current) =>
        sortMessages(
          current.some((existing) => existing.id === message.id)
            ? current.map((existing) =>
                existing.id === message.id
                  ? {
                      ...existing,
                      ...message,
                      attachment_url: message.attachment_url ?? existing.attachment_url,
                    }
                  : existing,
              )
            : [...current, message],
        ),
      );
    };
    const markIncomingMessagesRead = () => {
      void api
        .markChatMessagesRead(clientId)
        .then((readMessages) => {
          if (!active || !readMessages.length) return;
          const readAtById = new Map(readMessages.map((message) => [message.id, message.read_at]));
          setMessages((current) =>
            current.map((message) =>
              readAtById.has(message.id)
                ? { ...message, read_at: readAtById.get(message.id) ?? message.read_at }
                : message,
            ),
          );
        })
        .catch((cause: unknown) => {
          if (active) {
            setError(cause instanceof Error ? cause.message : "Unable to update read receipts.");
          }
        });
    };
    const unsubscribe = api.subscribeToChat(
      clientId,
      (message) => {
        addMessage(message);
        if (message.sender_id !== user.id) markIncomingMessagesRead();
        if (!message.attachment_path) {
          return;
        }
        void api
          .chatAttachmentUrl(message.attachment_path)
          .then((attachmentUrl) => {
            if (active) addMessage({ ...message, attachment_url: attachmentUrl });
          })
          .catch((cause: unknown) => {
            if (active) {
              setError(cause instanceof Error ? cause.message : "Unable to load chat attachment.");
            }
          });
      },
      (message) => {
        setMessages((current) =>
          current.map((existing) =>
            existing.id === message.id
              ? { ...message, attachment_url: existing.attachment_url }
              : existing,
          ),
        );
      },
      setError,
    );
    void api
      .chatMessages(clientId)
      .then((rows) => {
        if (active) {
          setMessages((current) => {
            const byId = new Map(current.map((message) => [message.id, message]));
            rows.forEach((message) => byId.set(message.id, message));
            return sortMessages([...byId.values()]);
          });
          markIncomingMessagesRead();
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load chat.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [clientId, user.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!clientId) return;
    const earlyIce = earlyIceRef.current;
    const channel = api.subscribeToChatCalls(
      clientId,
      (signal) => {
        if (signal.sender_id === user.id) return;
        if (signal.type === "offer" && signal.payload && "sdp" in signal.payload) {
          if (callRef.current || incomingOfferRef.current) return;
          incomingOfferRef.current = signal;
          callIdRef.current = signal.call_id;
          pendingIceRef.current = earlyIce.get(signal.call_id) ?? [];
          earlyIce.delete(signal.call_id);
          setIncomingOffer(signal);
          return;
        }
        if (signal.type === "hangup") {
          if (
            callIdRef.current === signal.call_id ||
            incomingOfferRef.current?.call_id === signal.call_id
          ) {
            closeCall();
          }
          return;
        }
        if (signal.type === "ice-candidate" && signal.payload && "candidate" in signal.payload) {
          if (signal.call_id === callIdRef.current) {
            addIceCandidate(signal.payload);
          } else if (!callIdRef.current) {
            const queued = earlyIce.get(signal.call_id) ?? [];
            if (queued.length < 50) {
              earlyIce.set(signal.call_id, [...queued, signal.payload]);
              if (earlyIce.size > 4) {
                const oldestCallId = earlyIce.keys().next().value;
                if (oldestCallId) earlyIce.delete(oldestCallId);
              }
            }
          }
          return;
        }
        if (signal.call_id !== callIdRef.current || !callRef.current || !signal.payload) return;
        if (signal.type === "answer" && "sdp" in signal.payload) {
          void callRef.current.peer
            .setRemoteDescription(signal.payload)
            .then(flushPendingIce)
            .catch((cause: unknown) => {
              setError(
                cause instanceof Error ? cause.message : "Unable to connect the voice call.",
              );
            });
        }
      },
      setError,
    );
    callChannelRef.current = channel;
    return () => {
      callChannelRef.current = null;
      const call = callRef.current;
      const activeCallId = call?.id ?? incomingOfferRef.current?.call_id;
      if (activeCallId) {
        void channel
          .send({
            type: "hangup",
            call_id: activeCallId,
            sender_id: user.id,
          })
          .catch((cause: unknown) => console.error("Unable to end the voice call.", cause))
          .finally(channel.unsubscribe);
      } else {
        channel.unsubscribe();
      }
      if (call) {
        call.peer.close();
        call.localStream.getTracks().forEach((track) => track.stop());
        callRef.current = null;
      }
      callIdRef.current = null;
      incomingOfferRef.current = null;
      earlyIce.clear();
    };
  }, [clientId, user.id]);

  useEffect(
    () => () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !clientId) return;
    setSending(true);
    setError("");
    try {
      const rows = await api.sendChatMessage(clientId, content, replyTo?.id ?? null);
      const message = rows[0];
      if (!message) throw new Error("The message was not returned after sending.");
      setMessages((current) =>
        sortMessages(
          current.some((existing) => existing.id === message.id) ? current : [...current, message],
        ),
      );
      setDraft("");
      setReplyTo(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send the message.");
    } finally {
      setSending(false);
    }
  }

  async function sendAttachment(file: File) {
    if (!clientId) return;
    setSending(true);
    setError("");
    try {
      const message = await api.sendChatAttachment(clientId, file, draft, replyTo?.id ?? null);
      setMessages((current) =>
        sortMessages(
          current.some((existing) => existing.id === message.id) ? current : [...current, message],
        ),
      );
      setDraft("");
      setReplyTo(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send the attachment.");
    } finally {
      setSending(false);
    }
  }

  function sendSignal(signal: Omit<ChatCallSignal, "sender_id">) {
    const channel = callChannelRef.current;
    if (!channel) return;
    void channel.send({ ...signal, sender_id: user.id }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Voice call connection failed.");
    });
  }

  function createPeer(id: string, stream: MediaStream) {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: "ice-candidate",
          call_id: id,
          payload: event.candidate.toJSON(),
        });
      }
    };
    peer.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0] ?? null;
        void remoteAudioRef.current.play().catch(() => {
          setError("Tap the audio player to hear the call.");
        });
      }
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") setCallStatus("connected");
      if (peer.connectionState === "failed") {
        setError("The voice call could not connect. Check the network and try again.");
        closeCall();
      }
    };
    return peer;
  }

  async function startCall() {
    if (!clientId || callRef.current || incomingOfferRef.current) return;
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Voice calls require microphone permission and a secure HTTPS connection.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const id = crypto.randomUUID();
      const peer = createPeer(id, stream);
      callRef.current = { id, peer, localStream: stream };
      callIdRef.current = id;
      pendingIceRef.current = [];
      earlyIceRef.current.clear();
      setCallStatus("dialing");
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sendSignal({ type: "offer", call_id: id, payload: peer.localDescription ?? offer });
    } catch (cause) {
      closeCall();
      setError(
        cause instanceof Error
          ? cause.message
          : "Microphone access is required to start a voice call.",
      );
    }
  }

  async function answerCall() {
    const offer = incomingOfferRef.current;
    if (!offer?.payload || !("sdp" in offer.payload) || !clientId) return;
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Voice calls require microphone permission and a secure HTTPS connection.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const peer = createPeer(offer.call_id, stream);
      callRef.current = { id: offer.call_id, peer, localStream: stream };
      callIdRef.current = offer.call_id;
      setIncomingOffer(null);
      setCallStatus("connecting");
      await peer.setRemoteDescription(offer.payload);
      await flushPendingIce();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sendSignal({
        type: "answer",
        call_id: offer.call_id,
        payload: peer.localDescription ?? answer,
      });
    } catch (cause) {
      closeCall();
      setError(
        cause instanceof Error
          ? cause.message
          : "Microphone access is required to answer a voice call.",
      );
    }
  }

  function addIceCandidate(candidate: RTCIceCandidateInit) {
    const peer = callRef.current?.peer;
    if (!peer || !peer.remoteDescription) {
      pendingIceRef.current.push(candidate);
      return;
    }
    void peer.addIceCandidate(candidate).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Unable to establish the call connection.");
    });
  }

  async function flushPendingIce() {
    const peer = callRef.current?.peer;
    if (!peer) return;
    const candidates = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const candidate of candidates) {
      await peer.addIceCandidate(candidate);
    }
  }

  function closeCall() {
    const call = callRef.current;
    call?.peer.close();
    call?.localStream.getTracks().forEach((track) => track.stop());
    callRef.current = null;
    callIdRef.current = null;
    incomingOfferRef.current = null;
    pendingIceRef.current = [];
    earlyIceRef.current.clear();
    setIncomingOffer(null);
    setCallStatus("idle");
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  }

  function endCall() {
    const id = callIdRef.current ?? incomingOfferRef.current?.call_id;
    if (id) sendSignal({ type: "hangup", call_id: id });
    closeCall();
  }

  async function toggleVoiceNote() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      return;
    }
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Voice recording is not supported by this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const supportedTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      const mimeType = supportedTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        setRecordingVoice(false);
        const type = recorder.mimeType || "audio/webm";
        const file = new File([new Blob(chunks, { type })], `voice-message-${Date.now()}`, {
          type,
        });
        if (file.size) void sendAttachment(file);
      };
      recorder.start();
      setRecordingVoice(true);
    } catch (cause) {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      setError(cause instanceof Error ? cause.message : "Unable to record a voice message.");
    }
  }

  function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void sendAttachment(file);
  }

  function replyPreview(message: ClientMessage) {
    if (message.content?.trim()) return message.content.trim();
    if (message.attachment_mime?.startsWith("image/")) return "Photo";
    if (message.attachment_mime?.startsWith("audio/")) return "Audio message";
    if (message.attachment_mime?.startsWith("video/")) return "Video";
    return "Message";
  }

  function jumpToMessage(messageId: string) {
    document
      .getElementById(`chat-message-${messageId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <main className="fixed inset-0 z-40 flex h-dvh flex-col overflow-hidden bg-[#e9e4dc] text-foreground">
      <header className="sticky top-0 z-10 flex min-h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-3 pt-[env(safe-area-inset-top)] shadow-sm sm:px-5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to workspace"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          {user.role === "admin" ? (
            <label className="block">
              <span className="sr-only">Choose client conversation</span>
              <select
                value={selectedClientId}
                onChange={(event) => {
                  if (callRef.current || incomingOfferRef.current) endCall();
                  setSelectedClientId(event.target.value);
                }}
                className="max-w-full truncate border-0 bg-transparent p-0 text-base font-semibold text-secondary outline-none focus:ring-0"
              >
                {!clients.length && <option value="">No clients available</option>}
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="truncate text-base font-semibold text-secondary">{contactName}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {callStatus === "connected"
              ? "Voice call connected"
              : callStatus === "dialing"
                ? "Calling…"
                : callStatus === "connecting"
                  ? "Connecting call…"
                  : "Messages are private"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => (callStatus === "idle" ? void startCall() : endCall())}
          disabled={!clientId || Boolean(incomingOffer)}
          aria-label={callStatus === "idle" ? "Start voice call" : "End voice call"}
          title={callStatus === "idle" ? "Voice call" : "End call"}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${
            callStatus === "idle"
              ? "text-primary hover:bg-accent"
              : "bg-destructive text-destructive-foreground"
          }`}
        >
          {callStatus === "idle" ? <Phone className="h-5 w-5" /> : <PhoneOff className="h-5 w-5" />}
        </button>
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-end gap-2">
          <div className="mb-2 flex justify-center">
            <NotificationPermissionButton className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card/90 px-3 text-xs font-medium text-secondary shadow-sm hover:bg-card disabled:cursor-default disabled:opacity-70" />
          </div>
          {loading && (
            <p className="my-auto flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading messages…
            </p>
          )}
          {!loading && !messages.length && clientId && (
            <div className="my-auto self-center rounded-2xl bg-card/90 px-5 py-3 text-center shadow-sm">
              <p className="text-sm font-semibold text-secondary">Start a conversation</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Send a message, photo, audio, or video to {contactName}.
              </p>
            </div>
          )}
          {!clientId && (
            <p className="my-auto self-center rounded-xl bg-card px-5 py-3 text-sm text-muted-foreground">
              Choose a client to open the conversation.
            </p>
          )}
          {messages.map((message) => {
            const ownMessage = message.sender_id === user.id;
            const category = message.attachment_mime?.split("/")[0];
            const quotedMessage = message.reply_to_id
              ? messages.find((candidate) => candidate.id === message.reply_to_id)
              : undefined;
            return (
              <article
                key={message.id}
                id={`chat-message-${message.id}`}
                onTouchStart={(event) => {
                  const touch = event.touches[0];
                  if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
                }}
                onTouchEnd={(event) => {
                  const start = touchStartRef.current;
                  const touch = event.changedTouches[0];
                  touchStartRef.current = null;
                  if (!start || !touch) return;
                  const deltaX = touch.clientX - start.x;
                  const deltaY = touch.clientY - start.y;
                  if (deltaX > 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
                    setReplyTo(message);
                  }
                }}
                className={`max-w-[88%] rounded-2xl px-3 py-2 shadow-sm sm:max-w-[75%] ${
                  ownMessage
                    ? "ml-auto rounded-br-sm bg-[#d9fdd3] text-foreground"
                    : "mr-auto rounded-bl-sm bg-card text-foreground"
                }`}
              >
                {message.reply_to_id && (
                  <button
                    type="button"
                    onClick={() => jumpToMessage(message.reply_to_id ?? "")}
                    className="mb-2 block w-full rounded-md border-l-2 border-primary bg-black/5 px-2 py-1 text-left"
                  >
                    <span className="block text-xs font-semibold text-primary">
                      {quotedMessage?.sender_id === user.id ? "You" : contactName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {quotedMessage ? replyPreview(quotedMessage) : "Replied message"}
                    </span>
                  </button>
                )}
                {message.attachment_path && (
                  <div className="mb-1.5 overflow-hidden">
                    {!message.attachment_url ? (
                      <span className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                        <LoaderCircle className="h-4 w-4 animate-spin" /> Loading attachment…
                      </span>
                    ) : category === "image" ? (
                      <a href={message.attachment_url} target="_blank" rel="noreferrer">
                        <img
                          src={message.attachment_url}
                          alt={message.attachment_name ?? "Chat image"}
                          loading="lazy"
                          className="max-h-80 max-w-full rounded-lg object-contain"
                        />
                      </a>
                    ) : category === "audio" ? (
                      <audio
                        controls
                        preload="metadata"
                        src={message.attachment_url}
                        className="max-w-full"
                      />
                    ) : category === "video" ? (
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        src={message.attachment_url}
                        className="max-h-80 max-w-full rounded-lg"
                      />
                    ) : (
                      <a
                        href={message.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-lg bg-background/70 p-3 text-sm underline"
                      >
                        {category === "audio" ? (
                          <FileAudio className="h-5 w-5" />
                        ) : (
                          <FileVideo className="h-5 w-5" />
                        )}
                        {message.attachment_name ?? "Open attachment"}
                      </a>
                    )}
                    {category && category !== "image" && (
                      <a
                        href={message.attachment_url}
                        download={message.attachment_name ?? true}
                        className="mt-1 block truncate text-xs text-primary underline"
                      >
                        {message.attachment_name}
                      </a>
                    )}
                  </div>
                )}
                {message.content && (
                  <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                )}
                <div className="mt-1 flex items-center justify-end gap-1">
                  <time dateTime={message.created_at} className="text-[10px] text-muted-foreground">
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  <button
                    type="button"
                    onClick={() => setReplyTo(message)}
                    aria-label="Reply to message"
                    title="Reply"
                    className="ml-1 rounded-full p-1 text-muted-foreground hover:bg-black/5 hover:text-primary"
                  >
                    <Reply className="h-3.5 w-3.5" />
                  </button>
                  {ownMessage &&
                    (message.read_at ? (
                      <span className="inline-flex items-center gap-0.5 text-primary" title="Read">
                        <CheckCheck aria-label="Read" className="h-4 w-4" />
                        <span className="sr-only">Read</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground" title="Sent">
                        <Check aria-label="Sent" className="h-3.5 w-3.5" />
                        <span className="sr-only">Sent</span>
                      </span>
                    ))}
                </div>
              </article>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {error && (
        <div className="z-10 mx-auto flex w-full max-w-3xl items-start gap-2 px-3 pb-2 sm:px-6">
          <p
            role="alert"
            className="flex-1 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      <form
        onSubmit={sendMessage}
        className="sticky bottom-0 z-10 flex shrink-0 flex-col gap-2 border-t border-border bg-card px-3 pb-[max(env(safe-area-inset-bottom),0.65rem)] pt-3 sm:px-6"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,audio/*,video/*"
          className="hidden"
          onChange={onFileSelected}
        />
        {replyTo && (
          <div className="mx-auto flex w-full max-w-3xl items-center gap-2 rounded-lg border-l-2 border-primary bg-muted/70 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-primary">
                Replying to {replyTo.sender_id === user.id ? "yourself" : contactName}
              </p>
              <p className="truncate text-sm text-muted-foreground">{replyPreview(replyTo)}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Cancel reply"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-background"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!clientId || sending || recordingVoice}
            aria-label="Attach image, audio, or video"
            title="Attach media"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={4000}
            rows={1}
            placeholder="Message"
            aria-label="Write a message"
            disabled={!clientId || sending || recordingVoice}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            className="max-h-28 min-h-11 flex-1 resize-y rounded-2xl border border-input bg-background px-4 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          {draft.trim() ? (
            <button
              type="submit"
              disabled={!clientId || sending}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
            >
              {sending ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void toggleVoiceNote()}
              disabled={!clientId || sending}
              aria-label={recordingVoice ? "Stop and send voice message" : "Record voice message"}
              title={recordingVoice ? "Stop recording" : "Record voice message"}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary-foreground disabled:opacity-50 ${
                recordingVoice ? "animate-pulse bg-destructive" : "bg-primary"
              }`}
            >
              {recordingVoice ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
            </button>
          )}
        </div>
      </form>

      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      {incomingOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="incoming-call-title"
            className="w-full max-w-sm rounded-2xl bg-card p-6 text-center shadow-xl"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Phone className="h-6 w-6" />
            </div>
            <h2 id="incoming-call-title" className="mt-4 text-lg font-bold text-secondary">
              Incoming voice call
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{contactName} is calling.</p>
            <div className="mt-6 flex justify-center gap-4">
              <button
                type="button"
                onClick={() => endCall()}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                aria-label="Decline call"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => void answerCall()}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground"
                aria-label="Answer call"
              >
                <Phone className="h-5 w-5" />
              </button>
            </div>
          </section>
        </div>
      )}

      {callStatus !== "idle" && callStatus !== "dialing" && (
        <button
          type="button"
          onClick={endCall}
          aria-label="End voice call"
          className="fixed bottom-24 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      )}
    </main>
  );
}
