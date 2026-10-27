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

// Ensure currency fields exist for backward compatibility
if (!isset($invoice['currency_code'])) {
    $invoice['currency_code'] = 'USD';
    $invoice['currency'] = '$ ';
    $invoice['base_currency'] = 'USD';
    $invoice['exchange_rate'] = 1.0;
}

// Handle mark as paid/unpaid
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['mark_paid'])) {
    $invoice['paid'] = true;
    $invoice['paid_date'] = date('Y-m-d H:i:s');
    file_put_contents($invoiceFile, json_encode($invoice, JSON_PRETTY_PRINT));
    header('Location: view.php?id=' . urlencode($invoiceId));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['mark_unpaid'])) {
    $invoice['paid'] = false;
    $invoice['paid_date'] = null;
    file_put_contents($invoiceFile, json_encode($invoice, JSON_PRETTY_PRINT));
    header('Location: view.php?id=' . urlencode($invoiceId));
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
    <meta name="description" content="View invoice <?php echo htmlspecialchars($invoice['invoice_number']); ?> - Codemath Invoice System">
    <link rel="manifest" href="manifest.json">
    <link rel="apple-touch-icon" href="icon-192x192.png">
    
    <!-- Open Graph / WhatsApp Preview -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://codemathphp.co.za/invoicing/view.php?id=<?php echo urlencode($invoiceId); ?>">
    <meta property="og:title" content="Invoice <?php echo htmlspecialchars($invoice['invoice_number']); ?> - CodemathPHP">
    <meta property="og:description" content="Invoice for <?php echo htmlspecialchars($invoice['client_name']); ?> - Total: <?php echo $invoice['currency'] . number_format($invoice['total'], 2); ?>">
    <meta property="og:image" content="https://codemathphp.co.za/assets/logo.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="Codemathphp Invoice System">
    
    <title>Invoice <?php echo htmlspecialchars($invoice['invoice_number']); ?> - CodemathPHP</title>
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
            display: flex;
            justify-content: space-between;
            align-items: center;
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
        .invoice-container {
            background: white;
            padding: 1.5rem;
            margin: 0 1rem;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            max-width: 800px;
            margin-left: auto;
            margin-right: auto;
        }
        .invoice-header {
            text-align: center;
            margin-bottom: 2rem;
            padding-bottom: 1.5rem;
            border-bottom: 2px solid #eee;
        }
        .logo {
            max-width: 150px;
            height: auto;
            margin-bottom: 1rem;
        }
        .invoice-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
        }
        .invoice-details h3 {
            color: #2c3e50;
            margin-bottom: 0.5rem;
            font-size: 1.1rem;
        }
        .invoice-details p {
            color: #7f8c8d;
            margin-bottom: 0.3rem;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1.5rem;
            font-size: 0.9rem;
        }
        .items-table th {
            background: #f8f9fa;
            padding: 0.6rem 0.5rem;
            text-align: left;
            font-weight: 600;
            color: #2c3e50;
            border-bottom: 2px solid #eee;
            font-size: 0.85rem;
        }
        .items-table td {
            padding: 0.6rem 0.5rem;
            border-bottom: 1px solid #eee;
        }
        .items-table tr:last-child td {
            border-bottom: none;
        }
        .text-right {
            text-align: right;
        }
        .table-wrapper {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            margin: 0 -1.5rem;
            padding: 0 1.5rem;
        }
        @media (max-width: 768px) {
            .items-table {
                display: block;
                width: 100%;
            }
            .items-table thead {
                display: none;
            }
            .items-table tbody {
                display: block;
            }
            .items-table tr {
                display: block;
                margin-bottom: 1rem;
                background: #f8f9fa;
                border-radius: 8px;
                padding: 0.75rem;
                border: 1px solid #e0e0e0;
            }
            .items-table td {
                display: block;
                padding: 0.5rem 0;
                text-align: right;
                border-bottom: 1px solid #e0e0e0;
            }
            .items-table td:before {
                content: attr(data-label);
                float: left;
                font-weight: 600;
                color: #6c757d;
                font-size: 0.85rem;
            }
            .items-table td:last-child {
                border-bottom: none;
            }
            .text-right {
                text-align: right !important;
            }
        }
        .total-section {
            text-align: right;
            margin-top: 1rem;
        }
        .total-row {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 0.5rem;
        }
        .total-label {
            width: 150px;
            text-align: right;
            padding-right: 1rem;
            color: #7f8c8d;
        }
        .total-value {
            width: 120px;
            text-align: right;
            font-weight: 600;
            color: #2c3e50;
        }
        .total-final {
            font-size: 1.3rem;
            color: #FF8C00;
            border-top: 2px solid #eee;
            padding-top: 0.5rem;
            margin-top: 0.5rem;
        }
        .payment-details {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 6px;
            margin-top: 1.5rem;
        }
        .payment-details h3 {
            color: #2c3e50;
            margin-bottom: 0.75rem;
        }
        .payment-details p {
            margin-bottom: 0.5rem;
            color: #495057;
        }
        .payment-details ul {
            margin-left: 1.5rem;
            margin-top: 0.5rem;
        }
        .payment-details li {
            margin-bottom: 0.3rem;
            color: #495057;
        }
        .notes {
            margin-top: 1.5rem;
            padding-top: 1.5rem;
            border-top: 2px solid #eee;
        }
        .notes h3 {
            color: #2c3e50;
            margin-bottom: 0.5rem;
        }
        .notes p {
            color: #495057;
        }
        .status-badge {
            display: inline-block;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            font-weight: 600;
            margin-bottom: 1rem;
        }
        .status-paid {
            background: #d4edda;
            color: #155724;
        }
        .status-unpaid {
            background: #fff3cd;
            color: #856404;
        }
        .payment-status {
            background: linear-gradient(135deg, #f8f9fa, #ffffff);
            padding: 1.25rem;
            border-radius: 16px;
            margin-bottom: 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            border: 1px solid rgba(0,0,0,0.05);
        }
        .actions {
            margin-top: 2rem;
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
        }
        .btn-paid {
            background: linear-gradient(135deg, #28a745, #20c997);
            box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
        }
        .btn-paid:active {
            box-shadow: 0 2px 6px rgba(40, 167, 69, 0.2);
        }
        .btn-unpaid {
            background: linear-gradient(135deg, #dc3545, #c82333);
            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
        }
        .btn-unpaid:active {
            box-shadow: 0 2px 6px rgba(220, 53, 69, 0.2);
        }
        .btn-success {
            background: linear-gradient(135deg, #28a745, #20c997);
            box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
        }
        .btn-success:active {
            box-shadow: 0 2px 6px rgba(40, 167, 69, 0.2);
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
        @media (max-width: 600px) {
            .invoice-info {
                grid-template-columns: 1fr;
            }
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
        <a href="index.php" class="btn btn-secondary">← Back to List</a>
        <a href="send.php?id=<?php echo urlencode($invoiceId); ?>" class="btn btn-success">Send Invoice</a>
    </div>

    <div class="invoice-container">
        <div class="invoice-header">
            <img src="https://codemathphp.co.za/assets/logo.png" alt="CodemathPHP Logo" class="logo">
            <h1 style="color: #2c3e50; margin-top: 0.5rem;">INVOICE</h1>
        </div>

        <div class="payment-status">
            <div>
                <span class="status-badge <?php echo (!empty($invoice['paid']) && $invoice['paid']) ? 'status-paid' : 'status-unpaid'; ?>">
                    <?php echo (!empty($invoice['paid']) && $invoice['paid']) ? '✓ PAID' : '● UNPAID'; ?>
                </span>
                <?php if (!empty($invoice['paid']) && $invoice['paid'] && !empty($invoice['paid_date'])): ?>
                    <p style="margin-top: 0.5rem; color: #7f8c8d; font-size: 0.85rem;">
                        Paid on <?php echo date('F d, Y', strtotime($invoice['paid_date'])); ?>
                    </p>
                <?php endif; ?>
            </div>
            <form method="post" style="display: inline;">
                <?php if (empty($invoice['paid']) || !$invoice['paid']): ?>
                    <button type="submit" name="mark_paid" class="btn btn-paid" onclick="return confirm('Mark this invoice as paid?');">Mark as Paid</button>
                <?php else: ?>
                    <button type="submit" name="mark_unpaid" class="btn btn-unpaid" onclick="return confirm('Mark this invoice as unpaid?');">Mark as Unpaid</button>
                <?php endif; ?>
            </form>
        </div>

        <div class="invoice-info">
            <div class="invoice-details">
                <h3>Bill To:</h3>
                <p><strong><?php echo htmlspecialchars($invoice['client_name']); ?></strong></p>
                <?php if (!empty($invoice['client_email'])): ?>
                    <p><?php echo htmlspecialchars($invoice['client_email']); ?></p>
                <?php endif; ?>
            </div>
            <div class="invoice-details" style="text-align: right;">
                <h3>Invoice Details:</h3>
                <p><strong>Invoice #:</strong> <?php echo htmlspecialchars($invoice['invoice_number']); ?></p>
                <p><strong>Date:</strong> <?php echo htmlspecialchars(date('F d, Y', strtotime($invoice['date']))); ?></p>
            </div>
        </div>

        <div class="table-wrapper">
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th class="text-right">Quantity</th>
                        <th class="text-right">Price</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($invoice['items'] as $item): ?>
                        <tr>
                            <td data-label="Description"><?php echo htmlspecialchars($item['description']); ?></td>
                            <td class="text-right" data-label="Quantity"><?php echo number_format($item['quantity'], 2); ?></td>
                            <td class="text-right" data-label="Price"><?php echo $invoice['currency'] . number_format($item['price'], 2); ?></td>
                            <td class="text-right" data-label="Total"><?php echo $invoice['currency'] . number_format($item['total'], 2); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <div class="total-section">
            <div class="total-row">
                <div class="total-label">Subtotal:</div>
                <div class="total-value"><?php echo $invoice['currency'] . number_format($invoice['subtotal'], 2); ?></div>
            </div>
            <div class="total-row total-final">
                <div class="total-label">Total:</div>
                <div class="total-value"><?php echo $invoice['currency'] . number_format($invoice['total'], 2); ?></div>
                <?php if (!empty($invoice['currency_code']) && $invoice['currency_code'] !== 'ZAR' && !empty($invoice['total_zar'])): ?>
                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #eee; font-size: 0.9rem; color: #6c757d;">
                        <div>Total in ZAR: R <?php echo number_format($invoice['total_zar'], 2); ?></div>
                        <div style="font-size: 0.85rem;">Exchange Rate: <?php echo $invoice['currency_code']; ?> 1 = R <?php echo number_format(1 / ($invoice['exchange_rate'] ?? 1), 4); ?></div>
                    </div>
                <?php endif; ?>
            </div>
        </div>

        <?php if (!empty($invoice['payment_method']) && !empty($invoice['payment_details'])): ?>
            <div class="payment-details">
                <h3>Payment Instructions - <?php echo ucfirst(str_replace('_', ' ', $invoice['payment_method'])); ?></h3>
                <?php
                $details = $invoice['payment_details'];
                if ($invoice['payment_method'] === 'paypal'): ?>
                    <?php if (!empty($details['email'])): ?>
                        <p><strong>PayPal Email:</strong> <?php echo htmlspecialchars($details['email']); ?></p>
                    <?php endif; ?>
                    <?php if (!empty($details['payment_link'])): ?>
                        <p><strong>Payment Link:</strong> <a href="<?php echo htmlspecialchars($details['payment_link']); ?>" target="_blank"><?php echo htmlspecialchars($details['payment_link']); ?></a></p>
                    <?php endif; ?>
                <?php elseif ($invoice['payment_method'] === 'bank_transfer'): ?>
                    <p><strong>Bank:</strong> <?php echo htmlspecialchars($details['bank_name'] ?? ''); ?></p>
                    <p><strong>Account Name:</strong> <?php echo htmlspecialchars($details['account_name'] ?? ''); ?></p>
                    <p><strong>Account Number:</strong> <?php echo htmlspecialchars($details['account_number'] ?? ''); ?></p>
                    <p><strong>Branch Code:</strong> <?php echo htmlspecialchars($details['branch_code'] ?? ''); ?></p>
                    <?php if (!empty($details['instructions'])): ?>
                        <ul>
                            <?php foreach ($details['instructions'] as $instruction): ?>
                                <li><?php echo htmlspecialchars($instruction); ?></li>
                            <?php endforeach; ?>
                        </ul>
                    <?php endif; ?>
                <?php elseif (in_array($invoice['payment_method'], ['ecocash', 'innbucks'])): ?>
                    <p><strong>Phone Number:</strong> <?php echo htmlspecialchars($details['phone_number'] ?? ''); ?></p>
                    <p><strong>Account Name:</strong> <?php echo htmlspecialchars($details['account_name'] ?? ''); ?></p>
                    <?php if (!empty($details['instructions'])): ?>
                        <ul>
                            <?php foreach ($details['instructions'] as $instruction): ?>
                                <li><?php echo htmlspecialchars($instruction); ?></li>
                            <?php endforeach; ?>
                        </ul>
                    <?php endif; ?>
                <?php elseif ($invoice['payment_method'] === 'medcard'): ?>
                    <p><strong>Card Number:</strong> <?php echo htmlspecialchars($details['card_number'] ?? ''); ?></p>
                    <p><strong>Account Name:</strong> <?php echo htmlspecialchars($details['account_name'] ?? ''); ?></p>
                    <?php if (!empty($details['instructions'])): ?>
                        <ul>
                            <?php foreach ($details['instructions'] as $instruction): ?>
                                <li><?php echo htmlspecialchars($instruction); ?></li>
                            <?php endforeach; ?>
                        </ul>
                    <?php endif; ?>
                <?php endif; ?>
            </div>
        <?php endif; ?>

        <?php if (!empty($invoice['notes'])): ?>
            <div class="notes">
                <h3>Notes:</h3>
                <p><?php echo nl2br(htmlspecialchars($invoice['notes'])); ?></p>
            </div>
        <?php endif; ?>

        <div class="actions">
            <a href="send.php?id=<?php echo urlencode($invoiceId); ?>" class="btn btn-success">Send via WhatsApp & Email</a>
            <?php if (empty($invoice['paid']) || !$invoice['paid']): ?>
                <a href="send.php?id=<?php echo urlencode($invoiceId); ?>&reminder=1" class="btn" style="background: #ffc107; color: #000;">Send Reminder</a>
            <?php endif; ?>
            <button onclick="window.print()" class="btn">Print</button>
        </div>
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

