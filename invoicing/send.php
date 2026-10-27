<?php
session_start();

if (!isset($_SESSION['invoicing_logged_in']) || $_SESSION['invoicing_logged_in'] !== true) {
    header('Location: login.php');
    exit;
}

$invoiceId = $_GET['id'] ?? '';
if (empty($invoiceId)) {
    header('Location: index.php');
    exit;
}

$invoiceFile = __DIR__ . '/data/' . basename($invoiceId);
if (!file_exists($invoiceFile)) {
    header('Location: index.php');
    exit;
}

$invoice = json_decode(file_get_contents($invoiceFile), true);
if (!$invoice) {
    header('Location: index.php');
    exit;
}

// Ensure paid field exists for backward compatibility
if (!isset($invoice['paid'])) {
    $invoice['paid'] = false;
    $invoice['paid_date'] = null;
}

$error = '';
$success = '';
$isReminder = isset($_GET['reminder']) && $_GET['reminder'] == '1';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $sendWhatsApp = isset($_POST['send_whatsapp']);
    $sendEmail = isset($_POST['send_email']);
    $whatsappNumber = trim($_POST['whatsapp_number'] ?? '');
    $isReminder = isset($_POST['is_reminder']) && $_POST['is_reminder'] == '1';
    
    if (!$sendWhatsApp && !$sendEmail) {
        $error = 'Please select at least one delivery method';
    } else {
        // Generate invoice text
        $invoiceText = generateInvoiceText($invoice, $isReminder);
        
        // Send WhatsApp
        if ($sendWhatsApp) {
            // Use provided number, or invoice phone, or invoice email as fallback
            $phone = $whatsappNumber ?: ($invoice['client_phone'] ?? $invoice['client_email'] ?? '');
            if ($phone) {
                // Clean phone number
                $phone = preg_replace('/[^0-9+]/', '', $phone);
                if (!str_starts_with($phone, '+')) {
                    $phone = '+27' . ltrim($phone, '0');
                }
                $whatsappUrl = 'https://wa.me/' . preg_replace('/[^0-9]/', '', $phone) . '?text=' . urlencode($invoiceText);
                header('Location: ' . $whatsappUrl);
                exit;
            }
        }
        
        // Send Email
        if ($sendEmail && !empty($invoice['client_email'])) {
            $emailSent = sendInvoiceEmail($invoice, $invoiceText, $isReminder);
            if ($emailSent) {
                $success = 'Invoice ' . ($isReminder ? 'reminder ' : '') . 'sent successfully!';
            } else {
                $error = 'Failed to send email';
            }
        } elseif ($sendEmail && empty($invoice['client_email'])) {
            $error = 'No email address available for this invoice';
        }
    }
}

$encodedInvoiceId = null;

function encodeInvoiceIdForShare($filename) {
    $base = base64_encode($filename);
    // Make URL safe
    return rtrim(strtr($base, '+/', '-_'), '=');
}

function generateInvoiceText($invoice, $isReminder = false) {
    // Get invoice view URL for WhatsApp preview (client-facing page)
    $invoiceId = basename($_GET['id'] ?? '');
    $shareId = encodeInvoiceIdForShare($invoiceId);
    $invoiceUrl = 'https://codemathphp.co.za/invoicing/invoice.php?id=' . urlencode($shareId);
    
    // Start with site URL to help platforms fetch site preview/logo
    $text = "https://codemathphp.co.za generated invoice\n\n";
    
    if ($isReminder) {
        $text .= "🔔 *PAYMENT REMINDER*\n";
        $text .= "This is a friendly reminder that the following invoice is still pending payment:\n\n";
    } else {
        $text .= "📄 *INVOICE*\n\n";
    }
    
    $text .= "*Invoice Details*\n";
    $text .= "Invoice #: *" . $invoice['invoice_number'] . "*\n";
    $text .= "Date: " . date('F d, Y', strtotime($invoice['date'])) . "\n";
    
    if ($isReminder) {
        $daysSince = floor((time() - strtotime($invoice['date'])) / 86400);
        $text .= "Days overdue: *" . $daysSince . " days*\n";
    }
    
    $text .= "\n*Bill To*\n";
    $text .= $invoice['client_name'] . "\n";
    if (!empty($invoice['client_email'])) {
        $text .= $invoice['client_email'] . "\n";
    }
    
    $text .= "\n*Items*\n";
    foreach ($invoice['items'] as $item) {
        $text .= "• " . $item['description'] . "\n";
        $text .= "  Qty: " . $item['quantity'] . " × " . $invoice['currency'] . number_format($item['price'], 2) . "\n";
        $text .= "  Total: *" . $invoice['currency'] . number_format($item['total'], 2) . "*\n\n";
    }
    
    $text .= "*Total Amount*\n";
    $text .= "*" . $invoice['currency'] . number_format($invoice['total'], 2) . "*\n";
    if (!empty($invoice['currency_code']) && $invoice['currency_code'] !== 'ZAR' && !empty($invoice['total_zar'])) {
        $text .= "ZAR Equivalent: R " . number_format($invoice['total_zar'], 2) . "\n";
    }
    
    if ($isReminder) {
        $text .= "\n⚠️ *Please make payment at your earliest convenience.*\n";
    }
    
    if (!empty($invoice['payment_method']) && !empty($invoice['payment_details'])) {
        $text .= "\n*Payment Instructions*\n";
        $text .= "Method: *" . ucfirst(str_replace('_', ' ', $invoice['payment_method'])) . "*\n\n";
        $details = $invoice['payment_details'];
        
        if ($invoice['payment_method'] === 'paypal') {
            if (!empty($details['email'])) {
                $text .= "PayPal Email:\n" . $details['email'] . "\n\n";
            }
            if (!empty($details['payment_link'])) {
                $text .= "Payment Link:\n" . $details['payment_link'] . "\n";
            }
        } elseif ($invoice['payment_method'] === 'bank_transfer') {
            $text .= "Bank: " . ($details['bank_name'] ?? '') . "\n";
            $text .= "Account Name: " . ($details['account_name'] ?? '') . "\n";
            $text .= "Account Number: " . ($details['account_number'] ?? '') . "\n";
            $text .= "Branch Code: " . ($details['branch_code'] ?? '') . "\n";
        } elseif (in_array($invoice['payment_method'], ['ecocash', 'innbucks'])) {
            $text .= "Phone Number: " . ($details['phone_number'] ?? '') . "\n";
            $text .= "Account Name: " . ($details['account_name'] ?? '') . "\n";
            if (!empty($details['instructions'])) {
                $text .= "\nInstructions:\n";
                foreach ($details['instructions'] as $instruction) {
                    $text .= "• " . $instruction . "\n";
                }
            }
        } elseif ($invoice['payment_method'] === 'medcard') {
            $text .= "Card Number: " . ($details['card_number'] ?? '') . "\n";
            $text .= "Account Name: " . ($details['account_name'] ?? '') . "\n";
            if (!empty($details['instructions'])) {
                $text .= "\nInstructions:\n";
                foreach ($details['instructions'] as $instruction) {
                    $text .= "• " . $instruction . "\n";
                }
            }
        }
    }
    
    if (!empty($invoice['notes'])) {
        $text .= "\n*Notes*\n";
        $text .= $invoice['notes'] . "\n";
    }
    
    $text .= "\nView invoice online:\n";
    $text .= $invoiceUrl . "\n";
    $text .= "\n";
    $text .= "Thank you for your business!\n";
    $text .= "CodemathPHP - https://codemathphp.co.za";
    
    return $text;
}

function sendInvoiceEmail($invoice, $text, $isReminder = false) {
    $to = $invoice['client_email'];
    if ($isReminder) {
        $subject = "Payment Reminder - Invoice #" . $invoice['invoice_number'] . " - CodemathPHP";
    } else {
        $subject = "Invoice #" . $invoice['invoice_number'] . " - CodemathPHP";
    }
    
    $invoiceId = basename($_GET['id'] ?? '');
    $shareId = encodeInvoiceIdForShare($invoiceId);
    $invoiceUrl = 'https://codemathphp.co.za/invoicing/invoice.php?id=' . urlencode($shareId);
    
    // Create HTML email
    $reminderNote = $isReminder ? '<div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 6px;">
        <h3 style="color: #856404; margin: 0 0 10px 0;">🔔 Payment Reminder</h3>
        <p style="color: #856404; margin: 0;">This is a friendly reminder that the following invoice is still pending payment. Please make payment at your earliest convenience.</p>
    </div>' : '';
    
    $html = '<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { max-width: 150px; height: auto; }
            .invoice-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .invoice-box h2 { color: #2c3e50; margin-bottom: 15px; }
            .invoice-details { margin-bottom: 20px; }
            .invoice-details p { margin: 5px 0; }
            .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .items-table th, .items-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            .items-table th { background: #f8f9fa; }
            .total { text-align: right; font-size: 1.2em; font-weight: bold; color: #FF8C00; margin-top: 20px; }
            .payment-details { background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            .site-line { text-align:center; color:#6c757d; font-size:12px; margin-top:-10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="https://codemathphp.co.za/assets/logo.png" alt="CodemathPHP" class="logo">
                <h1>' . ($isReminder ? 'PAYMENT REMINDER' : 'INVOICE') . '</h1>
            </div>
            <div class="site-line">
                <a href="https://codemathphp.co.za" style="color:#6c757d; text-decoration:none;">https://codemathphp.co.za generated invoice</a>
            </div>
            ' . $reminderNote . '
            
            <div class="invoice-box">
                <h2>Invoice #' . htmlspecialchars($invoice['invoice_number']) . '</h2>
                <div class="invoice-details">
                    <p><strong>Date:</strong> ' . date('F d, Y', strtotime($invoice['date'])) . '</p>
                    <p><strong>Bill To:</strong> ' . htmlspecialchars($invoice['client_name']) . '</p>
                </div>
                
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>';
    
    foreach ($invoice['items'] as $item) {
        $html .= '<tr>
            <td>' . htmlspecialchars($item['description']) . '</td>
            <td>' . number_format($item['quantity'], 2) . '</td>
            <td>' . $invoice['currency'] . number_format($item['price'], 2) . '</td>
            <td>' . $invoice['currency'] . number_format($item['total'], 2) . '</td>
        </tr>';
    }
    
    $html .= '</tbody>
                </table>
                <div class="total">Total: ' . $invoice['currency'] . number_format($invoice['total'], 2) . '</div>';
    if (!empty($invoice['currency_code']) && $invoice['currency_code'] !== 'ZAR' && !empty($invoice['total_zar'])) {
        $html .= '<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #ddd; font-size: 0.9rem; color: #666;">
            <div>Total in ZAR: R ' . number_format($invoice['total_zar'], 2) . '</div>
            <div style="font-size: 0.85rem;">Exchange Rate: ' . $invoice['currency_code'] . ' 1 = R ' . number_format(1 / ($invoice['exchange_rate'] ?? 1), 4) . '</div>
        </div>';
    }
    
    if (!empty($invoice['payment_method']) && !empty($invoice['payment_details'])) {
        $html .= '<div class="payment-details">
            <h3>Payment Instructions - ' . ucfirst(str_replace('_', ' ', $invoice['payment_method'])) . '</h3>';
        $details = $invoice['payment_details'];
        if ($invoice['payment_method'] === 'paypal') {
            if (!empty($details['email'])) {
                $html .= '<p><strong>PayPal Email:</strong> ' . htmlspecialchars($details['email']) . '</p>';
            }
            if (!empty($details['payment_link'])) {
                $html .= '<p><strong>Payment Link:</strong> <a href="' . htmlspecialchars($details['payment_link']) . '">' . htmlspecialchars($details['payment_link']) . '</a></p>';
            }
        } elseif ($invoice['payment_method'] === 'bank_transfer') {
            $html .= '<p><strong>Bank:</strong> ' . htmlspecialchars($details['bank_name'] ?? '') . '</p>';
            $html .= '<p><strong>Account Name:</strong> ' . htmlspecialchars($details['account_name'] ?? '') . '</p>';
            $html .= '<p><strong>Account Number:</strong> ' . htmlspecialchars($details['account_number'] ?? '') . '</p>';
            $html .= '<p><strong>Branch Code:</strong> ' . htmlspecialchars($details['branch_code'] ?? '') . '</p>';
        }
        $html .= '</div>';
    }
    
    if (!empty($invoice['notes'])) {
        $html .= '<p><strong>Notes:</strong> ' . nl2br(htmlspecialchars($invoice['notes'])) . '</p>';
    }
    
    $html .= '</div>
            <div class="footer">
                <p>Thank you for your business!</p>
                <p>CodemathPHP - Professional Cloud Solutions</p>
                <p><a href="' . htmlspecialchars($invoiceUrl) . '" style="color:#FF8C00; text-decoration:none;">View invoice online</a></p>
            </div>
        </div>
    </body>
    </html>';
    
    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-type: text/html; charset=UTF-8\r\n";
    $headers .= "From: CodemathPHP <support@codemathphp.co.za>\r\n";
    $headers .= "Reply-To: support@codemathphp.co.za\r\n";
    $headers .= "Return-Path: support@codemathphp.co.za\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
    
    $result = @mail($to, $subject, $html, $headers);
    
    // Log email attempt for debugging (check server error logs if emails fail)
    if (!$result) {
        error_log("Failed to send invoice email to: " . $to . " for invoice: " . $invoice['invoice_number']);
    }
    
    return $result;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="theme-color" content="#FF8C00">
    <meta name="description" content="Send invoice - CodemathPHP Invoice System">
    <link rel="manifest" href="manifest.json">
    <link rel="apple-touch-icon" href="icon-192x192.png">
    <title>Send Invoice - CodemathPHP</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 0;
            padding-bottom: 2rem;
            -webkit-font-smoothing: antialiased;
        }
        .header {
            background: white;
            padding: 1rem 1.25rem;
            margin-bottom: 1rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .btn {
            padding: 0.75rem 1.5rem;
            background: linear-gradient(135deg, #FF8C00, #FF6B35);
            color: white;
            text-decoration: none;
            border: none;
            border-radius: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 12px rgba(255, 140, 0, 0.3);
            font-size: 0.95rem;
            min-height: 44px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .btn:active {
            transform: scale(0.96);
            box-shadow: 0 2px 6px rgba(255, 140, 0, 0.2);
        }
        .btn-secondary {
            background: #6c757d;
            box-shadow: 0 4px 12px rgba(108, 117, 125, 0.3);
        }
        .btn-secondary:active {
            box-shadow: 0 2px 6px rgba(108, 117, 125, 0.2);
        }
        .form-container {
            background: white;
            padding: 1.5rem;
            margin: 0 1rem;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            max-width: 500px;
            margin-left: auto;
            margin-right: auto;
        }
        .form-group {
            margin-bottom: 1.25rem;
        }
        label {
            display: block;
            color: #1a1a1a;
            font-weight: 600;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
        }
        input[type="text"], input[type="tel"] {
            width: 100%;
            padding: 0.85rem;
            border: 2px solid #e0e0e0;
            border-radius: 12px;
            font-size: 1rem;
            transition: all 0.3s ease;
            background: #fafafa;
            min-height: 48px;
        }
        input:focus {
            outline: none;
            border-color: #FF8C00;
            background: white;
            box-shadow: 0 0 0 4px rgba(255, 140, 0, 0.1);
        }
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1.25rem;
            padding: 0.75rem;
            background: #f8f9fa;
            border-radius: 12px;
        }
        .checkbox-group input[type="checkbox"] {
            width: 24px;
            height: 24px;
            cursor: pointer;
            accent-color: #FF8C00;
        }
        .drawer {
            position: fixed;
            left: -280px;
            top: 0;
            width: 280px;
            height: 100vh;
            background: white;
            box-shadow: 2px 0 8px rgba(0,0,0,0.1);
            transition: left 0.3s ease;
            z-index: 1000;
            overflow-y: auto;
        }
        .drawer.open {
            left: 0;
        }
        .drawer-header {
            padding: 1.5rem;
            background: linear-gradient(135deg, #FF8C00, #FF6B35);
            color: white;
        }
        .drawer-header h2 {
            font-size: 1.25rem;
            margin-bottom: 0.5rem;
        }
        .drawer-menu {
            list-style: none;
            padding: 1rem 0;
        }
        .drawer-menu li a {
            display: block;
            padding: 1rem 1.5rem;
            color: #1a1a1a;
            text-decoration: none;
            border-bottom: 1px solid #f0f0f0;
            transition: background 0.2s;
        }
        .drawer-menu li a:hover,
        .drawer-menu li a.active {
            background: #f8f9fa;
            color: #FF8C00;
        }
        .overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 999;
        }
        .overlay.show {
            display: block;
        }
        .menu-btn {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0.5rem;
            color: #1a1a1a;
            min-width: 44px;
            min-height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .error {
            background: #fee;
            color: #c0392b;
            padding: 0.75rem;
            border-radius: 6px;
            margin-bottom: 1rem;
        }
        .success {
            background: #d4edda;
            color: #155724;
            padding: 0.75rem;
            border-radius: 6px;
            margin-bottom: 1rem;
        }
        .preview {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 6px;
            margin-bottom: 1rem;
            font-family: monospace;
            font-size: 0.85rem;
            white-space: pre-wrap;
            max-height: 300px;
            overflow-y: auto;
        }
    </style>
</head>
<body>
    <div class="overlay" id="overlay" onclick="toggleDrawer()"></div>
    <div class="drawer" id="drawer">
        <div class="drawer-header">
            <h2>CodemathPHP</h2>
            <p>Invoice System</p>
        </div>
        <ul class="drawer-menu">
            <li><a href="index.php">- Invoices</a></li>
            <li><a href="create.php">- New Invoice</a></li>
            <li><a href="manage.php?page=clients">- Clients</a></li>
            <li><a href="manage.php?page=services">- Services</a></li>
            <li><a href="manage.php?page=exchange_rates">- Rates</a></li>
            <li><a href="login.php?logout=1">- Logout</a></li>
        </ul>
    </div>

    <div class="header">
        <button class="menu-btn" onclick="toggleDrawer()">☰</button>
        <a href="view.php?id=<?php echo urlencode($invoiceId); ?>" class="btn btn-secondary">← Back</a>
    </div>

    <div class="form-container">
        <h2 style="margin-bottom: 1.5rem; color: #2c3e50;"><?php echo $isReminder ? 'Send Payment Reminder' : 'Send Invoice'; ?></h2>
        
        <?php if ($error): ?>
            <div class="error"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>
        
        <?php if ($success): ?>
            <div class="success"><?php echo htmlspecialchars($success); ?></div>
        <?php endif; ?>
        
        <?php if ($isReminder && (empty($invoice['paid']) || !$invoice['paid'])): ?>
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                <strong>🔔 Reminder Notice:</strong> This invoice is currently unpaid. Sending a payment reminder.
            </div>
        <?php endif; ?>
        
        <div class="preview">
            <?php echo htmlspecialchars(generateInvoiceText($invoice, $isReminder)); ?>
        </div>
        
        <form method="post">
            <input type="hidden" name="is_reminder" value="<?php echo $isReminder ? '1' : '0'; ?>">
            
            <div class="checkbox-group">
                <input type="checkbox" id="send_whatsapp" name="send_whatsapp" checked>
                <label for="send_whatsapp">Send via WhatsApp</label>
            </div>
            
            <div class="form-group">
                <label for="whatsapp_number">WhatsApp Number</label>
                <input type="tel" id="whatsapp_number" name="whatsapp_number" 
                       placeholder="+27123456789" 
                       value="<?php echo htmlspecialchars($invoice['client_phone'] ?? ''); ?>">
                <?php if (empty($invoice['client_phone'])): ?>
                    <small style="color: #6c757d; font-size: 0.85rem; display: block; margin-top: 0.25rem;">
                        No phone number saved for this client. Please enter manually.
                    </small>
                <?php endif; ?>
            </div>
            
            <div class="checkbox-group">
                <input type="checkbox" id="send_email" name="send_email" <?php echo !empty($invoice['client_email']) ? 'checked' : ''; ?> <?php echo empty($invoice['client_email']) ? 'disabled' : ''; ?>>
                <label for="send_email">Send via Email <?php echo empty($invoice['client_email']) ? '(No email address)' : ''; ?></label>
            </div>
            
            <button type="submit" class="btn" style="width: 100%; margin-top: 1rem;">
                <?php echo $isReminder ? 'Send Reminder' : 'Send Invoice'; ?>
            </button>
        </form>
    </div>

    <script>
        function toggleDrawer() {
            const drawer = document.getElementById('drawer');
            const overlay = document.getElementById('overlay');
            drawer.classList.toggle('open');
            overlay.classList.toggle('show');
        }

        // Register Service Worker for PWA
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js')
                    .then((registration) => {
                        console.log('ServiceWorker registered:', registration.scope);
                    })
                    .catch((error) => {
                        console.log('ServiceWorker registration failed:', error);
                    });
            });
        }
    </script>
</body>
</html>

