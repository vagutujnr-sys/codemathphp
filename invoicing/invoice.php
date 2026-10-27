<?php
// Client-facing invoice view - no authentication required
$invoiceIdParam = $_GET['id'] ?? '';
$invoiceId = $invoiceIdParam;

function decodeInvoiceId($id) {
    if (str_contains($id, '.json')) {
        return $id;
    }
    $translated = strtr($id, '-_', '+/');
    $pad = strlen($translated) % 4;
    if ($pad) {
        $translated .= str_repeat('=', 4 - $pad);
    }
    $decoded = base64_decode($translated, true);
    if ($decoded === false) {
        return $id;
    }
    return $decoded;
}

if (!empty($invoiceIdParam)) {
    $invoiceId = decodeInvoiceId($invoiceIdParam);
}
if (empty($invoiceId)) {
    header('HTTP/1.0 404 Not Found');
    exit;
}

$invoiceFile = __DIR__ . '/data/' . basename($invoiceId);
if (!file_exists($invoiceFile)) {
    header('HTTP/1.0 404 Not Found');
    exit;
}

$invoice = json_decode(file_get_contents($invoiceFile), true);
if (!$invoice) {
    header('HTTP/1.0 404 Not Found');
    exit;
}

// Ensure currency fields exist for backward compatibility
if (!isset($invoice['currency_code'])) {
    $invoice['currency_code'] = 'ZAR';
    $invoice['currency'] = 'R ';
    $invoice['base_currency'] = 'ZAR';
    $invoice['exchange_rate'] = 1.0;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#FF8C00">
    <meta name="description" content="Invoice <?php echo htmlspecialchars($invoice['invoice_number']); ?> - CodemathPHP">
    
    <!-- Open Graph / WhatsApp Preview -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://codemathphp.co.za/invoicing/invoice.php?id=<?php echo urlencode($invoiceId); ?>">
    <meta property="og:title" content="Invoice <?php echo htmlspecialchars($invoice['invoice_number']); ?> - codemathPHP">
    <meta property="og:description" content="Invoice for <?php echo htmlspecialchars($invoice['client_name']); ?> - Total: <?php echo $invoice['currency'] . number_format($invoice['total'], 2); ?>">
    <meta property="og:image" content="https://codemathphp.co.za/assets/logo.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="CodemathPHP">
    
    <title>Invoice <?php echo htmlspecialchars($invoice['invoice_number']); ?> - CodemathPHP</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #ffffff;
            padding: 0;
            padding-bottom: 2rem;
            -webkit-font-smoothing: antialiased;
            color: #1a1a1a;
        }
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 2rem 1.5rem;
        }
        .invoice-header {
            text-align: center;
            margin-bottom: 2.5rem;
            padding-bottom: 2rem;
            border-bottom: 2px solid #e0e0e0;
        }
        .logo {
            max-width: 180px;
            height: auto;
            margin-bottom: 1.5rem;
        }
        .invoice-title {
            font-size: 2rem;
            color: #2c3e50;
            margin-bottom: 0.5rem;
            font-weight: 700;
        }
        .invoice-number {
            font-size: 1.1rem;
            color: #6c757d;
            font-weight: 500;
        }
        .invoice-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
            padding: 1.5rem;
            background: #f8f9fa;
            border-radius: 12px;
        }
        .info-section h3 {
            color: #2c3e50;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 0.75rem;
            font-weight: 600;
        }
        .info-section p {
            color: #1a1a1a;
            margin-bottom: 0.5rem;
            font-size: 0.95rem;
        }
        .table-wrapper {
            overflow-x: auto;
            margin: 2rem 0;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.95rem;
        }
        .items-table th {
            background: #f8f9fa;
            padding: 1rem 0.75rem;
            text-align: left;
            font-weight: 600;
            color: #2c3e50;
            border-bottom: 2px solid #e0e0e0;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .items-table td {
            padding: 1rem 0.75rem;
            border-bottom: 1px solid #e0e0e0;
        }
        .items-table tr:last-child td {
            border-bottom: none;
        }
        .text-right {
            text-align: right;
        }
        .total-section {
            margin-top: 2rem;
            padding-top: 1.5rem;
            border-top: 2px solid #e0e0e0;
        }
        .total-row {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            margin-bottom: 0.75rem;
            font-size: 1rem;
        }
        .total-label {
            margin-right: 1.5rem;
            color: #6c757d;
            font-weight: 500;
        }
        .total-value {
            min-width: 150px;
            text-align: right;
            color: #1a1a1a;
            font-weight: 500;
        }
        .total-final {
            font-size: 1.3rem;
            font-weight: 700;
            color: #FF8C00;
            padding-top: 0.5rem;
            border-top: 2px solid #e0e0e0;
        }
        .payment-section {
            margin-top: 2.5rem;
            padding: 1.5rem;
            background: #f8f9fa;
            border-radius: 12px;
        }
        .payment-section h3 {
            color: #2c3e50;
            margin-bottom: 1rem;
            font-size: 1.1rem;
        }
        .payment-section p {
            margin-bottom: 0.75rem;
            color: #1a1a1a;
            line-height: 1.6;
        }
        .payment-section strong {
            color: #2c3e50;
        }
        .notes-section {
            margin-top: 2rem;
            padding: 1.5rem;
            background: #fff9e6;
            border-radius: 12px;
            border-left: 4px solid #ffc107;
        }
        .notes-section h3 {
            color: #2c3e50;
            margin-bottom: 0.75rem;
            font-size: 1rem;
        }
        .notes-section p {
            color: #1a1a1a;
            line-height: 1.6;
            white-space: pre-wrap;
        }
        .status-badge {
            display: inline-block;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            margin-top: 0.5rem;
        }
        .status-paid {
            background: #d4edda;
            color: #155724;
        }
        .status-unpaid {
            background: #f8d7da;
            color: #721c24;
        }
        @media (max-width: 768px) {
            .invoice-container {
                padding: 1.5rem 1rem;
            }
            .invoice-header {
                margin-bottom: 2rem;
                padding-bottom: 1.5rem;
            }
            .invoice-title {
                font-size: 1.5rem;
            }
            .invoice-info {
                grid-template-columns: 1fr;
                gap: 1.5rem;
            }
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
                padding: 1rem;
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
            .total-row {
                font-size: 0.95rem;
            }
            .total-value {
                min-width: 120px;
            }
            .total-final {
                font-size: 1.2rem;
            }
        }
        @media print {
            body {
                background: white;
            }
            .invoice-container {
                max-width: 100%;
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="invoice-header">
            <img src="https://codemathphp.co.za/assets/logo.png" alt="CodemathPHP Logo" class="logo">
            <h1 class="invoice-title">INVOICE</h1>
            <p class="invoice-number">Invoice #<?php echo htmlspecialchars($invoice['invoice_number']); ?></p>
        </div>

        <div class="invoice-info">
            <div class="info-section">
                <h3>Bill To</h3>
                <p><strong><?php echo htmlspecialchars($invoice['client_name']); ?></strong></p>
                <?php if (!empty($invoice['client_email'])): ?>
                    <p><?php echo htmlspecialchars($invoice['client_email']); ?></p>
                <?php endif; ?>
                <?php if (!empty($invoice['client_phone'])): ?>
                    <p><?php echo htmlspecialchars($invoice['client_phone']); ?></p>
                <?php endif; ?>
            </div>
            <div class="info-section">
                <h3>Invoice Details</h3>
                <p><strong>Date:</strong> <?php echo htmlspecialchars(date('F d, Y', strtotime($invoice['date']))); ?></p>
                <p><strong>Invoice #:</strong> <?php echo htmlspecialchars($invoice['invoice_number']); ?></p>
                <?php if (isset($invoice['paid']) && $invoice['paid']): ?>
                    <span class="status-badge status-paid">✓ Paid</span>
                    <?php if (!empty($invoice['paid_date'])): ?>
                        <p style="margin-top: 0.5rem; font-size: 0.85rem; color: #6c757d;">
                            Paid on: <?php echo htmlspecialchars(date('F d, Y', strtotime($invoice['paid_date']))); ?>
                        </p>
                    <?php endif; ?>
                <?php else: ?>
                    <span class="status-badge status-unpaid">Pending Payment</span>
                <?php endif; ?>
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
            <?php if (!empty($invoice['currency_code']) && $invoice['currency_code'] !== 'ZAR' && !empty($invoice['total_zar'])): ?>
                <div class="total-row" style="font-size: 0.9rem; color: #6c757d;">
                    <div class="total-label">Total in ZAR:</div>
                    <div class="total-value">R <?php echo number_format($invoice['total_zar'], 2); ?></div>
                </div>
            <?php endif; ?>
            <div class="total-row total-final">
                <div class="total-label">Total:</div>
                <div class="total-value"><?php echo $invoice['currency'] . number_format($invoice['total'], 2); ?></div>
            </div>
        </div>

        <?php if (!empty($invoice['payment_method']) && !empty($invoice['payment_details'])): ?>
            <div class="payment-section">
                <h3>Payment Instructions</h3>
                <p><strong>Payment Method:</strong> <?php echo ucfirst(str_replace('_', ' ', $invoice['payment_method'])); ?></p>
                <?php
                $details = $invoice['payment_details'];
                if ($invoice['payment_method'] === 'paypal'): ?>
                    <?php if (!empty($details['email'])): ?>
                        <p><strong>PayPal Email:</strong> <?php echo htmlspecialchars($details['email']); ?></p>
                    <?php endif; ?>
                    <?php if (!empty($details['payment_link'])): ?>
                        <p><strong>Payment Link:</strong> <a href="<?php echo htmlspecialchars($details['payment_link']); ?>" target="_blank" style="color: #FF8C00; text-decoration: none;"><?php echo htmlspecialchars($details['payment_link']); ?></a></p>
                    <?php endif; ?>
                <?php elseif ($invoice['payment_method'] === 'bank_transfer'): ?>
                    <p><strong>Bank:</strong> <?php echo htmlspecialchars($details['bank_name'] ?? ''); ?></p>
                    <p><strong>Account Name:</strong> <?php echo htmlspecialchars($details['account_name'] ?? ''); ?></p>
                    <p><strong>Account Number:</strong> <?php echo htmlspecialchars($details['account_number'] ?? ''); ?></p>
                    <p><strong>Branch Code:</strong> <?php echo htmlspecialchars($details['branch_code'] ?? ''); ?></p>
                <?php elseif (in_array($invoice['payment_method'], ['ecocash', 'innbucks'])): ?>
                    <p><strong>Phone Number:</strong> <?php echo htmlspecialchars($details['phone_number'] ?? ''); ?></p>
                    <p><strong>Account Name:</strong> <?php echo htmlspecialchars($details['account_name'] ?? ''); ?></p>
                    <?php if (!empty($details['instructions'])): ?>
                        <p style="margin-top: 1rem;"><strong>Instructions:</strong></p>
                        <ul style="margin-left: 1.5rem; margin-top: 0.5rem;">
                            <?php foreach ($details['instructions'] as $instruction): ?>
                                <li><?php echo htmlspecialchars($instruction); ?></li>
                            <?php endforeach; ?>
                        </ul>
                    <?php endif; ?>
                <?php elseif ($invoice['payment_method'] === 'medcard'): ?>
                    <p><strong>Card Number:</strong> <?php echo htmlspecialchars($details['card_number'] ?? ''); ?></p>
                    <p><strong>Account Name:</strong> <?php echo htmlspecialchars($details['account_name'] ?? ''); ?></p>
                    <?php if (!empty($details['instructions'])): ?>
                        <p style="margin-top: 1rem;"><strong>Instructions:</strong></p>
                        <ul style="margin-left: 1.5rem; margin-top: 0.5rem;">
                            <?php foreach ($details['instructions'] as $instruction): ?>
                                <li><?php echo htmlspecialchars($instruction); ?></li>
                            <?php endforeach; ?>
                        </ul>
                    <?php endif; ?>
                <?php endif; ?>
            </div>
        <?php endif; ?>

        <?php if (!empty($invoice['notes'])): ?>
            <div class="notes-section">
                <h3>Notes</h3>
                <p><?php echo nl2br(htmlspecialchars($invoice['notes'])); ?></p>
            </div>
        <?php endif; ?>

        <div style="text-align: center; margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #e0e0e0; color: #6c757d; font-size: 0.9rem;">
            <p>Thank you for your business!</p>
            <p style="margin-top: 0.5rem;">CodemathPHP - Professional Hosting Solutions</p>
            <p style="margin-top: 0.5rem;"><a href="https://codemathphp.co.za" style="color: #FF8C00; text-decoration: none;">codemathphp.co.za</a></p>
        </div>
    </div>
</body>
</html>

