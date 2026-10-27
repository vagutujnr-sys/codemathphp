<?php
// Enable error reporting for debugging (remove in production or set to 0)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Start session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Handle logout
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: login.php');
    exit;
}

$error = '';
$pin = '198689';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $enteredPin = $_POST['pin'] ?? '';
    
    if ($enteredPin === $pin) {
        $_SESSION['invoicing_logged_in'] = true;
        header('Location: index.php');
        exit;
    } else {
        $error = 'Invalid PIN';
    }
}

// If already logged in, redirect
if (isset($_SESSION['invoicing_logged_in']) && $_SESSION['invoicing_logged_in'] === true) {
    header('Location: index.php');
    exit;
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
    <meta name="description" content="CodemathPHP Invoice System - Create, manage and send invoices">
    <link rel="manifest" href="manifest.json">
    <link rel="apple-touch-icon" href="icon-192x192.png">
    <title>Invoice System Login</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 1rem;
            -webkit-font-smoothing: antialiased;
        }
        .login-container {
            background: white;
            border-radius: 18px;
            box-shadow: 0 16px 40px rgba(0,0,0,0.18);
            padding: 1.75rem 1.5rem;
            width: 100%;
            max-width: 320px;
            text-align: center;
            animation: fadeIn 0.25s ease-out;
        }
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(12px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .logo {
            max-width: 110px;
            height: auto;
            margin-bottom: 1.25rem;
        }
        h1 {
            color: #1a1a1a;
            font-size: 1.4rem;
            margin-bottom: 0.35rem;
            font-weight: 700;
            letter-spacing: -0.5px;
        }
        .subtitle {
            color: #6c757d;
            font-size: 0.85rem;
            margin-bottom: 1.75rem;
        }
        .error {
            background: #fee;
            color: #c0392b;
            padding: 0.75rem;
            border-radius: 10px;
            margin-bottom: 1rem;
            font-size: 0.85rem;
            border-left: 3px solid #c0392b;
        }
        .form-group {
            margin-bottom: 1.1rem;
            text-align: left;
        }
        label {
            display: block;
            color: #1a1a1a;
            font-weight: 600;
            margin-bottom: 0.5rem;
            font-size: 0.85rem;
        }
        input[type="password"] {
            width: 100%;
            padding: 0.85rem;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 1.3rem;
            text-align: center;
            letter-spacing: 0.18rem;
            background: #fafafa;
            transition: all 0.3s ease;
            min-height: 48px;
        }
        input[type="password"]:focus {
            outline: none;
            border-color: #FF8C00;
            background: white;
            box-shadow: 0 0 0 4px rgba(255, 140, 0, 0.1);
        }
        .btn-login {
            width: 100%;
            padding: 0.85rem;
            background: linear-gradient(135deg, #FF8C00, #FF6B35);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            margin-top: 0.25rem;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 6px 18px rgba(255, 140, 0, 0.32);
            min-height: 48px;
        }
        .btn-login:active {
            transform: scale(0.97);
            box-shadow: 0 3px 10px rgba(255, 140, 0, 0.25);
        }
    </style>
</head>
<body>
    <div class="login-container">
        <img src="https://codemathphp.co.za/assets/logo.png" alt="CodemathPHP Logo" class="logo">
        <h1>Invoice System</h1>
        <p class="subtitle">Enter PIN to access</p>
        
        <?php if ($error): ?>
            <div class="error"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>
        
        <form method="post">
            <div class="form-group">
                <label for="pin">PIN</label>
                <input type="password" id="pin" name="pin" maxlength="6" required autofocus>
            </div>
            <button type="submit" class="btn-login">Login</button>
        </form>
    </div>

    <script>
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

