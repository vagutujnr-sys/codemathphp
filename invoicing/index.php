<?php
// Enable error reporting for debugging (remove in production or set to 0)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Start session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Check authentication
if (!isset($_SESSION['invoicing_logged_in']) || $_SESSION['invoicing_logged_in'] !== true) {
    header('Location: login.php');
    exit;
}

// Get all invoices
$invoicesDir = __DIR__ . '/data';
if (!is_dir($invoicesDir)) {
    if (!mkdir($invoicesDir, 0755, true)) {
        die('Error: Could not create data directory. Please check folder permissions.');
    }
}

$invoices = [];
$error = '';

try {
    if (is_dir($invoicesDir) && is_readable($invoicesDir)) {
        $files = glob($invoicesDir . '/invoice_*.json');
        if ($files === false) {
            $error = 'Error reading invoice files.';
        } else {
            foreach ($files as $file) {
                if (!is_readable($file)) {
                    continue;
                }
                $content = @file_get_contents($file);
                if ($content === false) {
                    continue;
                }
                $data = @json_decode($content, true);
                if ($data && is_array($data)) {
                    // Ensure paid field exists for backward compatibility
                    if (!isset($data['paid'])) {
                        $data['paid'] = false;
                        $data['paid_date'] = null;
                    }
                    // Ensure currency fields exist for backward compatibility
                    if (!isset($data['currency'])) {
                        $data['currency'] = '$';
                        $data['currency_code'] = 'USD';
                    }
                    $data['file'] = basename($file);
                    $invoices[] = $data;
                }
            }
            // Sort by date, newest first
            if (!empty($invoices)) {
                usort($invoices, function($a, $b) {
                    $dateA = isset($a['date']) ? strtotime($a['date']) : 0;
                    $dateB = isset($b['date']) ? strtotime($b['date']) : 0;
                    return $dateB - $dateA;
                });
            }
        }
    } else {
        $error = 'Data directory is not accessible.';
    }
} catch (Exception $e) {
    $error = 'Error loading invoices: ' . htmlspecialchars($e->getMessage());
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
    <meta name="description" content="BetaDeck Invoice System - Create, manage and send invoices">
    <link rel="manifest" href="manifest.json">
    <link rel="apple-touch-icon" href="icon-192x192.png">
    <title>Invoices - CodemathPHP</title>
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
            padding-bottom: 100px;
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        .header {
            background: white;
            padding: 1rem 1.25rem;
            margin-bottom: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            position: sticky;
            top: 0;
            z-index: 100;
            backdrop-filter: blur(10px);
        }
        .logo {
            max-width: 110px;
            height: auto;
        }
        .btn {
            padding: 0.75rem 1.5rem;
            background: linear-gradient(135deg, #FF8C00, #FF6B35);
            color: white;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            display: inline-block;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 12px rgba(255, 140, 0, 0.3);
            border: none;
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
        .invoice-list {
            padding: 0 1rem;
            display: grid;
            gap: 1rem;
        }
        .invoice-card {
            background: white;
            padding: 1.25rem;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(0,0,0,0.05);
        }
        .invoice-card:active {
            transform: scale(0.98);
            box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 0.75rem;
        }
        .invoice-number {
            font-weight: 700;
            color: #1a1a1a;
            font-size: 1.15rem;
            letter-spacing: -0.3px;
        }
        .invoice-date {
            color: #6c757d;
            font-size: 0.875rem;
            margin-top: 0.25rem;
        }
        .invoice-client {
            color: #2c3e50;
            margin-bottom: 0.75rem;
            font-size: 0.9rem;
        }
        .invoice-total {
            font-size: 1.35rem;
            font-weight: 700;
            color: #FF8C00;
            letter-spacing: -0.5px;
        }
        .status-badge {
            display: inline-flex;
            align-items: center;
            padding: 0.4rem 0.85rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            margin-top: 0.5rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .status-paid {
            background: linear-gradient(135deg, #d4edda, #c3e6cb);
            color: #155724;
        }
        .status-unpaid {
            background: linear-gradient(135deg, #fff3cd, #ffeaa7);
            color: #856404;
        }
        .invoice-actions {
            margin-top: 1rem;
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }
        .btn-small {
            padding: 0.6rem 1rem;
            font-size: 0.875rem;
            min-height: 40px;
            flex: 1;
            min-width: 80px;
        }
        .btn-warning {
            background: linear-gradient(135deg, #ffc107, #ffb300);
            color: #000;
            box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
        }
        .btn-warning:active {
            box-shadow: 0 2px 6px rgba(255, 193, 7, 0.2);
        }
        .empty-state {
            text-align: center;
            padding: 4rem 1.5rem;
            color: #6c757d;
        }
        .empty-state h2 {
            margin-bottom: 0.75rem;
            color: #2c3e50;
            font-size: 1.5rem;
        }
        .fab {
            position: fixed;
            bottom: 2rem;
            right: 1.5rem;
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: linear-gradient(135deg, #FF8C00, #FF6B35);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 24px rgba(255, 140, 0, 0.4);
            text-decoration: none;
            font-size: 2rem;
            font-weight: 300;
            z-index: 1000;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .fab:active {
            transform: scale(0.9);
            box-shadow: 0 4px 12px rgba(255, 140, 0, 0.3);
        }
        .header-actions {
            display: flex;
            gap: 0.5rem;
            align-items: center;
        }
        @media (max-width: 480px) {
            .header {
                padding: 1rem;
            }
            .logo {
                max-width: 90px;
            }
            .btn {
                padding: 0.65rem 1.2rem;
                font-size: 0.875rem;
            }
            .invoice-list {
                padding: 0 0.75rem;
            }
            .invoice-card {
                padding: 1rem;
            }
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
            <li><a href="index.php" class="active">- Invoices</a></li>
            <li><a href="create.php">- New Invoice</a></li>
            <li><a href="manage.php?page=clients">- Clients</a></li>
            <li><a href="manage.php?page=services">- Services</a></li>
            <li><a href="manage.php?page=exchange_rates">- Rates</a></li>
            <li><a href="login.php?logout=1">- Logout</a></li>
        </ul>
    </div>

    <div class="header">
        <button class="menu-btn" onclick="toggleDrawer()">☰</button>
        <img src="https://codemathphp.co.za/assets/logo.png" alt="CodemathPHP" class="logo">
        <div class="header-actions">
            <a href="login.php?logout=1" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.85rem;">Logout</a>
        </div>
    </div>

    <div class="invoice-list">
        <?php if (!empty($error)): ?>
            <div class="empty-state" style="color: #c0392b;">
                <h2>Error</h2>
                <p><?php echo htmlspecialchars($error); ?></p>
                <a href="create.php" class="btn" style="margin-top: 1rem;">Create Invoice</a>
            </div>
        <?php elseif (empty($invoices)): ?>
            <div class="empty-state">
                <h2>No Invoices Yet</h2>
                <p>Create your first invoice to get started</p>
                <a href="create.php" class="btn" style="margin-top: 1rem;">Create Invoice</a>
            </div>
        <?php else: ?>
            <?php foreach ($invoices as $invoice): ?>
                <div class="invoice-card">
                    <div class="invoice-header">
                        <div>
                            <div class="invoice-number"><?php echo htmlspecialchars($invoice['invoice_number']); ?></div>
                            <div class="invoice-date"><?php echo htmlspecialchars(date('M d, Y', strtotime($invoice['date']))); ?></div>
                        </div>
                        <div class="invoice-total"><?php echo htmlspecialchars($invoice['currency'] . number_format($invoice['total'], 2)); ?></div>
                    </div>
                    <div class="invoice-client">
                        <strong>Client:</strong> <?php echo htmlspecialchars($invoice['client_name']); ?><br>
                        <?php if (!empty($invoice['client_email'])): ?>
                            <small><?php echo htmlspecialchars($invoice['client_email']); ?></small>
                        <?php endif; ?>
                        <div>
                            <span class="status-badge <?php echo (!empty($invoice['paid']) && $invoice['paid']) ? 'status-paid' : 'status-unpaid'; ?>">
                                <?php echo (!empty($invoice['paid']) && $invoice['paid']) ? '✓ Paid' : '● Unpaid'; ?>
                            </span>
                            <?php if (!empty($invoice['paid']) && $invoice['paid'] && !empty($invoice['paid_date'])): ?>
                                <small style="color: #7f8c8d; margin-left: 0.5rem;">on <?php echo date('M d, Y', strtotime($invoice['paid_date'])); ?></small>
                            <?php endif; ?>
                        </div>
                    </div>
                    <div class="invoice-actions">
                        <a href="view.php?id=<?php echo urlencode($invoice['file']); ?>" class="btn btn-small">View</a>
                        <a href="send.php?id=<?php echo urlencode($invoice['file']); ?>" class="btn btn-small">Send</a>
                        <?php if (empty($invoice['paid']) || !$invoice['paid']): ?>
                            <a href="send.php?id=<?php echo urlencode($invoice['file']); ?>&reminder=1" class="btn btn-small btn-warning">Reminder</a>
                        <?php endif; ?>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>

    <a href="create.php" class="fab" title="Create New Invoice">+</a>

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

        // Show install prompt
        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            showInstallButton();
        });

        function showInstallButton() {
            // Check if already installed
            if (window.matchMedia('(display-mode: standalone)').matches) {
                return;
            }

            // Create install button
            const installBtn = document.createElement('div');
            installBtn.id = 'install-prompt';
            installBtn.innerHTML = `
                <div style="position: fixed; bottom: 90px; right: 1.5rem; background: white; padding: 1rem; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); z-index: 999; max-width: 280px; animation: slideUp 0.3s ease-out;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem; color: #1a1a1a;">Install App</div>
                    <div style="font-size: 0.85rem; color: #6c757d; margin-bottom: 1rem;">Install BetaDeck Invoice for quick access</div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button onclick="installApp()" style="flex: 1; background: linear-gradient(135deg, #FF8C00, #FF6B35); color: white; border: none; padding: 0.75rem; border-radius: 12px; font-weight: 600; cursor: pointer; min-height: 44px;">Install</button>
                        <button onclick="dismissInstall()" style="background: #e0e0e0; color: #1a1a1a; border: none; padding: 0.75rem 1rem; border-radius: 12px; font-weight: 600; cursor: pointer; min-height: 44px;">×</button>
                    </div>
                </div>
            `;
            document.body.appendChild(installBtn);
        }

        function installApp() {
            if (!deferredPrompt) return;
            
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                }
                deferredPrompt = null;
                dismissInstall();
            });
        }

        function dismissInstall() {
            const prompt = document.getElementById('install-prompt');
            if (prompt) {
                prompt.remove();
            }
        }

        function toggleDrawer() {
            const drawer = document.getElementById('drawer');
            const overlay = document.getElementById('overlay');
            drawer.classList.toggle('open');
            overlay.classList.toggle('show');
        }
    </script>
</body>
</html>

