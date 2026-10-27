<?php
session_start();

if (!isset($_SESSION['invoicing_logged_in']) || $_SESSION['invoicing_logged_in'] !== true) {
    header('Location: login.php');
    exit;
}

// Load payment details
$paymentDetailsFile = __DIR__ . '/payment_details.json';
$paymentMethods = [];
$paymentData = [];
if (file_exists($paymentDetailsFile)) {
    $paymentData = json_decode(file_get_contents($paymentDetailsFile), true) ?: [];
    $paymentMethods = array_keys($paymentData);
}

$error = '';
$success = '';

// Load exchange rates
$exchangeRatesFile = __DIR__ . '/exchange_rates.json';
$exchangeRates = ['base_currency' => 'USD', 'rates' => ['USD' => 1.00, 'RAND' => 18.75]];
if (file_exists($exchangeRatesFile)) {
    $exchangeData = json_decode(file_get_contents($exchangeRatesFile), true);
    if ($exchangeData) {
        $exchangeRates = $exchangeData;
    }
}

$currencies = [
    'USD' => ['symbol' => '$', 'name' => 'US Dollar']
];

// Preload clients and services data for the UI
$clientsData = [];
$clientsFile = __DIR__ . '/clients.json';
if (file_exists($clientsFile)) {
    $clientsJson = json_decode(file_get_contents($clientsFile), true);
    if ($clientsJson && isset($clientsJson['clients']) && is_array($clientsJson['clients'])) {
        $clientsData = $clientsJson['clients'];
    }
}

$servicesData = [];
$servicesFile = __DIR__ . '/services.json';
if (file_exists($servicesFile)) {
    $servicesJson = json_decode(file_get_contents($servicesFile), true);
    if ($servicesJson && isset($servicesJson['services']) && is_array($servicesJson['services'])) {
        $servicesData = $servicesJson['services'];
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $invoiceNumber = trim($_POST['invoice_number'] ?? '');
    $date = trim($_POST['date'] ?? date('Y-m-d'));
    $clientName = trim($_POST['client_name'] ?? '');
    $clientEmail = trim($_POST['client_email'] ?? '');
    $clientPhone = trim($_POST['client_phone'] ?? '');
    $items = $_POST['items'] ?? [];
    $paymentMethod = trim($_POST['payment_method'] ?? '');
    $notes = trim($_POST['notes'] ?? '');
    $selectedCurrency = trim($_POST['currency'] ?? 'ZAR');
    
    // Get exchange rate
    $exchangeRate = $exchangeRates['rates'][$selectedCurrency] ?? 1.0;
    
    if (empty($invoiceNumber) || empty($clientName) || empty($items)) {
        $error = 'Please fill in all required fields';
    } else {
        // Calculate total
        $subtotal = 0;
        $validItems = [];
        foreach ($items as $item) {
            if (!empty($item['description']) && !empty($item['price'])) {
                $price = floatval($item['price']);
                $quantity = floatval($item['quantity'] ?? 1);
                $itemTotal = $price * $quantity;
                $subtotal += $itemTotal;
                $validItems[] = [
                    'description' => $item['description'],
                    'quantity' => $quantity,
                    'price' => $price,
                    'total' => $itemTotal
                ];
            }
        }
        
        if (empty($validItems)) {
            $error = 'Please add at least one item';
        } else {
            // Convert amounts if currency is not USD
            $convertedSubtotal = $subtotal;
            $convertedItems = $validItems;
            if ($selectedCurrency !== 'USD' && isset($exchangeRates['rates'][$selectedCurrency])) {
                $rate = $exchangeRates['rates'][$selectedCurrency];
                $convertedSubtotal = $subtotal * $rate;
                $convertedItems = [];
                foreach ($validItems as $item) {
                    $convertedItem = $item;
                    $convertedItem['price'] = $item['price'] * $rate;
                    $convertedItem['total'] = $item['total'] * $rate;
                    $convertedItem['price_zar'] = $item['price']; // Keep original ZAR price
                    $convertedItem['total_zar'] = $item['total']; // Keep original ZAR total
                    $convertedItems[] = $convertedItem;
                }
            }
            
            // Create invoice data
            $invoiceData = [
                'invoice_number' => $invoiceNumber,
                'date' => $date,
                'client_name' => $clientName,
                'client_email' => $clientEmail,
                'client_phone' => $clientPhone,
                'items' => $convertedItems,
                'subtotal' => $convertedSubtotal,
                'total' => $convertedSubtotal,
                'currency' => $currencies[$selectedCurrency]['symbol'] ?? 'R ',
                'currency_code' => $selectedCurrency,
                'base_currency' => 'USD',
                'exchange_rate' => $exchangeRate,
                'subtotal_zar' => $subtotal, // Keep original ZAR amount
                'total_zar' => $subtotal, // Keep original ZAR amount
                'payment_method' => $paymentMethod,
                'payment_details' => $paymentMethod ? ($paymentData[$paymentMethod] ?? []) : [],
                'notes' => $notes,
                'paid' => false,
                'paid_date' => null,
                'created_at' => date('Y-m-d H:i:s')
            ];
            
            // Save invoice
            $invoicesDir = __DIR__ . '/data';
            if (!is_dir($invoicesDir)) {
                mkdir($invoicesDir, 0755, true);
            }
            
            $filename = 'invoice_' . time() . '_' . preg_replace('/[^a-zA-Z0-9]/', '_', $invoiceNumber) . '.json';
            $filepath = $invoicesDir . '/' . $filename;
            
            if (file_put_contents($filepath, json_encode($invoiceData, JSON_PRETTY_PRINT))) {
                header('Location: view.php?id=' . urlencode($filename));
                exit;
            } else {
                $error = 'Failed to save invoice';
            }
        }
    }
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
    <meta name="description" content="Create a new invoice - BetaDeck Invoice System">
    <link rel="manifest" href="manifest.json">
    <link rel="apple-touch-icon" href="icon-192x192.png">
    <title>Create Invoice - CodemathPHP</title>
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
        .logo {
            max-width: 110px;
            height: auto;
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
            display: inline-block;
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
            max-width: 600px;
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
        input, select, textarea {
            width: 100%;
            padding: 0.85rem;
            border: 2px solid #e0e0e0;
            border-radius: 12px;
            font-size: 1rem;
            transition: all 0.3s ease;
            background: #fafafa;
            min-height: 48px;
        }
        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: #FF8C00;
            background: white;
            box-shadow: 0 0 0 4px rgba(255, 140, 0, 0.1);
        }
        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }
        .items-section {
            margin-top: 1.5rem;
            padding-top: 1.5rem;
            border-top: 2px solid #eee;
        }
        .item-row {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr auto;
            gap: 0.75rem;
            margin-bottom: 0.75rem;
            align-items: end;
        }
        .btn-remove {
            background: #dc3545;
            color: white;
            border: none;
            padding: 0.6rem;
            border-radius: 10px;
            cursor: pointer;
            min-width: 48px;
            min-height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
        }
        .btn-remove:active {
            transform: scale(0.95);
        }
        .btn-add {
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            border: none;
            padding: 0.75rem 1.25rem;
            border-radius: 12px;
            cursor: pointer;
            margin-top: 0.5rem;
            font-weight: 600;
            min-height: 48px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
        }
        .btn-add:active {
            transform: scale(0.96);
        }
        .error {
            background: #fee;
            color: #c0392b;
            padding: 1rem;
            border-radius: 12px;
            margin-bottom: 1rem;
            border-left: 4px solid #c0392b;
        }
        h2 {
            font-size: 1.5rem;
            letter-spacing: -0.5px;
        }
        .service-item {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 12px;
            border: 2px solid #e0e0e0;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .service-item:active {
            transform: scale(0.98);
            background: #e9ecef;
            border-color: #FF8C00;
        }
        .service-name {
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 0.25rem;
            font-size: 0.95rem;
        }
        .service-description {
            color: #6c757d;
            font-size: 0.85rem;
            margin-bottom: 0.5rem;
        }
        .service-price {
            color: #FF8C00;
            font-weight: 700;
            font-size: 1.1rem;
        }
        .service-category {
            display: inline-block;
            background: #e3f2fd;
            color: #1976d2;
            padding: 0.25rem 0.5rem;
            border-radius: 8px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-top: 0.5rem;
        }
        .client-item {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 12px;
            border: 2px solid #e0e0e0;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .client-item:active {
            transform: scale(0.98);
            background: #e9ecef;
            border-color: #FF8C00;
        }
        .client-name {
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 0.25rem;
            font-size: 0.95rem;
        }
        .client-company {
            color: #6c757d;
            font-size: 0.85rem;
            margin-bottom: 0.25rem;
        }
        .client-email {
            color: #FF8C00;
            font-size: 0.85rem;
            margin-bottom: 0.25rem;
        }
        .client-phone {
            color: #6c757d;
            font-size: 0.8rem;
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
            .form-row {
                grid-template-columns: 1fr;
            }
            .item-row {
                grid-template-columns: 1fr;
            }
            .form-container {
                margin: 0 0.75rem;
                padding: 1.25rem;
            }
        }
    </style>
</head>
<body>
    <div class="overlay" id="overlay" onclick="toggleDrawer()"></div>
    <div class="drawer" id="drawer">
        <div class="drawer-header">
            <h2>BetaDeck</h2>
            <p>Invoice System</p>
        </div>
        <ul class="drawer-menu">
            <li><a href="index.php">- Invoices</a></li>
            <li><a href="create.php" class="active">- New Invoice</a></li>
            <li><a href="manage.php?page=clients">- Clients</a></li>
            <li><a href="manage.php?page=services">- Services</a></li>
            <li><a href="manage.php?page=exchange_rates">- Rates</a></li>
            <li><a href="login.php?logout=1">- Logout</a></li>
        </ul>
    </div>

    <div class="header">
        <button class="menu-btn" onclick="toggleDrawer()">☰</button>
        <img src="https://codemathphp.co.za/logo.png" alt="BetaDeck" class="logo">
        <a href="index.php" class="btn btn-secondary">Back</a>
    </div>

    <div class="form-container">
        <h2 style="margin-bottom: 1.5rem; color: #2c3e50;">Create New Invoice</h2>
        
        <?php if ($error): ?>
            <div class="error"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>
        
        <form method="post" id="invoiceForm">
            <div class="form-row">
                <div class="form-group">
                    <label for="invoice_number">Invoice Number *</label>
                    <input type="text" id="invoice_number" name="invoice_number" required 
                           value="<?php echo htmlspecialchars($_POST['invoice_number'] ?? 'INV-' . date('Ymd') . '-' . rand(1000, 9999)); ?>">
                </div>
                <div class="form-group">
                    <label for="date">Date *</label>
                    <input type="date" id="date" name="date" required 
                           value="<?php echo htmlspecialchars($_POST['date'] ?? date('Y-m-d')); ?>">
                </div>
            </div>
            
            <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <label for="client_name">Client Name *</label>
                    <button type="button" class="btn" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="showClientPicker()">👤 Select Client</button>
                </div>
                <input type="text" id="client_name" name="client_name" required 
                       value="<?php echo htmlspecialchars($_POST['client_name'] ?? ''); ?>">
            </div>
            
            <div class="form-group">
                <label for="client_email">Client Email</label>
                <input type="email" id="client_email" name="client_email" 
                       value="<?php echo htmlspecialchars($_POST['client_email'] ?? ''); ?>">
            </div>
            
            <div class="form-group">
                <label for="client_phone">Client Phone (for WhatsApp)</label>
                <input type="tel" id="client_phone" name="client_phone" 
                       placeholder="+27123456789"
                       value="<?php echo htmlspecialchars($_POST['client_phone'] ?? ''); ?>">
            </div>
            
            <!-- Client Picker Modal -->
            <div id="clientPicker" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; padding: 1rem; overflow-y: auto;">
                <div style="background: white; border-radius: 16px; padding: 1.5rem; max-width: 500px; margin: 2rem auto; max-height: 80vh; overflow-y: auto;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0; color: #2c3e50;">Select Client</h3>
                        <button type="button" onclick="closeClientPicker()" style="background: #dc3545; color: white; border: none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-size: 1.2rem; min-width: 40px; min-height: 40px;">×</button>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <input type="text" id="clientSearch" placeholder="Search clients..." style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 12px; font-size: 0.95rem;" onkeyup="filterClients()">
                    </div>
                    <div id="clientsList" style="display: grid; gap: 0.75rem;">
                        <!-- Clients will be populated here -->
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label for="currency">Currency *</label>
                <select id="currency" name="currency" required onchange="updateCurrencyDisplay()">
                    <?php foreach ($currencies as $code => $info): ?>
                        <option value="<?php echo htmlspecialchars($code); ?>" 
                                data-symbol="<?php echo htmlspecialchars($info['symbol']); ?>"
                                <?php echo (($_POST['currency'] ?? 'ZAR') === $code) ? 'selected' : ''; ?>>
                            <?php echo htmlspecialchars($info['name'] . ' (' . $info['symbol'] . ')'); ?>
                        </option>
                    <?php endforeach; ?>
                </select>
                <small style="color: #6c757d; font-size: 0.85rem; display: block; margin-top: 0.25rem;">
                    Prices are stored in USD and converted using current exchange rates
                </small>
            </div>
            
            <div class="items-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0; color: #2c3e50;">Items</h3>
                    <button type="button" class="btn" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="showServicePicker()">📋 Add from Services</button>
                </div>
                
                <!-- Service Picker Modal -->
                <div id="servicePicker" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; padding: 1rem; overflow-y: auto;">
                    <div style="background: white; border-radius: 16px; padding: 1.5rem; max-width: 500px; margin: 2rem auto; max-height: 80vh; overflow-y: auto;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0; color: #2c3e50;">Select Service</h3>
                            <button type="button" onclick="closeServicePicker()" style="background: #dc3545; color: white; border: none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-size: 1.2rem; min-width: 40px; min-height: 40px;">×</button>
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <input type="text" id="serviceSearch" placeholder="Search services..." style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 12px; font-size: 0.95rem;" onkeyup="filterServices()">
                        </div>
                        <div id="servicesList" style="display: grid; gap: 0.75rem;">
                            <!-- Services will be populated here -->
                        </div>
                    </div>
                </div>
                
                <div id="items-container">
                    <!-- Items will be added here dynamically -->
                </div>
                <button type="button" class="btn-add" onclick="addItem()">+ Add Custom Item</button>
            </div>
            
            <div class="form-group">
                <label for="payment_method">Payment Method</label>
                <select id="payment_method" name="payment_method">
                    <option value="">Select payment method</option>
                    <?php foreach ($paymentMethods as $method): ?>
                        <option value="<?php echo htmlspecialchars($method); ?>">
                            <?php echo ucfirst(str_replace('_', ' ', $method)); ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
            
            <div class="form-group">
                <label for="notes">Notes</label>
                <textarea id="notes" name="notes" rows="3" placeholder="Additional notes..."><?php echo htmlspecialchars($_POST['notes'] ?? ''); ?></textarea>
            </div>
            
            <button type="submit" class="btn" style="width: 100%; margin-top: 1rem;">Create Invoice</button>
        </form>
    </div>

    <script>
        let itemCount = 0;
        let services = <?php echo json_encode($servicesData, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP); ?>;
        let clients = <?php echo json_encode($clientsData, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP); ?>;
        let exchangeRates = {};
        let currentCurrency = 'ZAR';
        let currencySymbol = 'R ';
        
        // Add initial empty item row and render pickers on page load
        document.addEventListener('DOMContentLoaded', function() {
            addItem();
            renderServices();
            renderClients();
        });
        
        // Load exchange rates
        fetch('exchange_rates.json')
            .then(response => response.json())
            .then(data => {
                exchangeRates = data.rates || {};
            })
            .catch(error => {
                console.error('Error loading exchange rates:', error);
            });
        
        // Load clients from JSON
        fetch('clients.json')
            .then(response => response.ok ? response.json() : null)
            .then(data => {
                if (data && Array.isArray(data.clients)) {
                    clients = data.clients;
                    renderClients();
                }
            })
            .catch(error => {
                console.error('Error loading clients:', error);
            });
        
        // Load services from JSON
        fetch('services.json')
            .then(response => response.ok ? response.json() : null)
            .then(data => {
                if (data && Array.isArray(data.services)) {
                    services = data.services;
                    renderServices();
                }
            })
            .catch(error => {
                console.error('Error loading services:', error);
            });
        
        function updateCurrencyDisplay() {
            const currencySelect = document.getElementById('currency');
            currentCurrency = currencySelect.value;
            const selectedOption = currencySelect.options[currencySelect.selectedIndex];
            currencySymbol = selectedOption.getAttribute('data-symbol');
            
            // Update all price inputs to show currency symbol
            const priceInputs = document.querySelectorAll('input[name*="[price]"]');
            priceInputs.forEach(input => {
                const currentValue = parseFloat(input.value) || 0;
                if (currentValue > 0 && currentCurrency !== 'USD') {
                    // Convert from USD to selected currency
                    const rate = exchangeRates[currentCurrency] || 1;
                    const converted = currentValue * rate;
                    input.value = converted.toFixed(2);
                }
            });
            
            // Update service prices display
            renderServices();
        }
        
        function renderServices(filteredServices = null) {
            const servicesList = document.getElementById('servicesList');
            const servicesToShow = filteredServices || services;
            
            if (servicesToShow.length === 0) {
                servicesList.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 2rem;">No services found</p>';
                return;
            }
            
            // Group by category
            const grouped = {};
            servicesToShow.forEach(service => {
                const category = service.category || 'Other';
                if (!grouped[category]) {
                    grouped[category] = [];
                }
                grouped[category].push(service);
            });
            
            let html = '';
            Object.keys(grouped).sort().forEach(category => {
                html += `<div style="margin-bottom: 1.5rem;"><h4 style="color: #6c757d; font-size: 0.85rem; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">${category}</h4>`;
                grouped[category].forEach(service => {
                    // Convert price based on selected currency
                    let displayPrice = service.price;
                    let displaySymbol = '$';
                    if (currentCurrency !== 'USD' && exchangeRates[currentCurrency]) {
                        displayPrice = service.price * exchangeRates[currentCurrency];
                        displaySymbol = currencySymbol;
                    } else {
                        displaySymbol = '$ ';
                    }
                    
                    html += `
                        <div class="service-item" onclick="addServiceToInvoice(${service.id})">
                            <div class="service-name">${service.name}</div>
                            <div class="service-description">${service.description}</div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div class="service-price">${displaySymbol}${displayPrice.toFixed(2)}</div>
                                <span class="service-category">${category}</span>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            });
            
            servicesList.innerHTML = html;
        }
        
        function filterServices() {
            const search = document.getElementById('serviceSearch').value.toLowerCase();
            const filtered = services.filter(service => 
                service.name.toLowerCase().includes(search) ||
                service.description.toLowerCase().includes(search) ||
                (service.category && service.category.toLowerCase().includes(search))
            );
            renderServices(filtered);
        }
        
        function showServicePicker() {
            document.getElementById('servicePicker').style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
        
        function closeServicePicker() {
            document.getElementById('servicePicker').style.display = 'none';
            document.body.style.overflow = '';
            document.getElementById('serviceSearch').value = '';
            renderServices();
        }
        
        function addServiceToInvoice(serviceId) {
            const service = services.find(s => s.id === serviceId);
            if (!service) return;
            
            // Use original ZAR price - conversion happens on server
            const price = service.price;
            
            const container = document.getElementById('items-container');
            const itemRow = document.createElement('div');
            itemRow.className = 'item-row';
            itemRow.innerHTML = `
                <input type="text" name="items[${itemCount}][description]" value="${escapeHtml(service.name)} - ${escapeHtml(service.description)}" required>
                <input type="number" name="items[${itemCount}][quantity]" placeholder="Qty" value="1" min="1" step="0.01" required>
                <input type="number" name="items[${itemCount}][price]" value="${price}" min="0" step="0.01" required placeholder="Price (ZAR)">
                <button type="button" class="btn-remove" onclick="removeItem(this)">Remove</button>
            `;
            container.appendChild(itemRow);
            itemCount++;
            
            // Scroll to the new item
            itemRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
            // Close picker
            closeServicePicker();
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        function removeItem(button) {
            const itemRow = button.closest('.item-row');
            if (itemRow) {
                itemRow.remove();
                // Re-index remaining items
                reindexItems();
            }
        }
        
        function reindexItems() {
            const container = document.getElementById('items-container');
            const rows = container.querySelectorAll('.item-row');
            rows.forEach((row, index) => {
                const inputs = row.querySelectorAll('input');
                inputs.forEach(input => {
                    const name = input.name;
                    if (name.includes('[')) {
                        const newName = name.replace(/items\[\d+\]/, `items[${index}]`);
                        input.name = newName;
                    }
                });
            });
            itemCount = rows.length;
        }
        
        function addItem() {
            const container = document.getElementById('items-container');
            const itemRow = document.createElement('div');
            itemRow.className = 'item-row';
            itemRow.innerHTML = `
                <input type="text" name="items[${itemCount}][description]" placeholder="Item description" required>
                <input type="number" name="items[${itemCount}][quantity]" placeholder="Qty" value="1" min="1" step="0.01" required>
                <input type="number" name="items[${itemCount}][price]" placeholder="Price (ZAR)" min="0" step="0.01" required>
                <button type="button" class="btn-remove" onclick="removeItem(this)">Remove</button>
            `;
            container.appendChild(itemRow);
            itemCount++;
            itemRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        function renderClients(filteredClients = null) {
            const clientsList = document.getElementById('clientsList');
            const clientsToShow = filteredClients || clients;
            
            if (clientsToShow.length === 0) {
                clientsList.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 2rem;">No clients found</p>';
                return;
            }
            
            let html = '';
            clientsToShow.forEach(client => {
                html += `
                    <div class="client-item" onclick="selectClient(${client.id})">
                        <div class="client-name">${client.name}</div>
                        ${client.company ? `<div class="client-company">${client.company}</div>` : ''}
                        ${client.email ? `<div class="client-email">${client.email}</div>` : ''}
                        ${client.phone ? `<div class="client-phone">${client.phone}</div>` : ''}
                        ${client.notes ? `<div style="margin-top: 0.5rem; font-size: 0.8rem; color: #6c757d; font-style: italic;">${client.notes}</div>` : ''}
                    </div>
                `;
            });
            
            clientsList.innerHTML = html;
        }
        
        function filterClients() {
            const search = document.getElementById('clientSearch').value.toLowerCase();
            const filtered = clients.filter(client => 
                client.name.toLowerCase().includes(search) ||
                (client.company && client.company.toLowerCase().includes(search)) ||
                (client.email && client.email.toLowerCase().includes(search)) ||
                (client.phone && client.phone.toLowerCase().includes(search))
            );
            renderClients(filtered);
        }
        
        function showClientPicker() {
            document.getElementById('clientPicker').style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
        
        function closeClientPicker() {
            document.getElementById('clientPicker').style.display = 'none';
            document.body.style.overflow = '';
            document.getElementById('clientSearch').value = '';
            renderClients();
        }
        
        function selectClient(clientId) {
            const client = clients.find(c => c.id === clientId);
            if (!client) return;
            
            // Fill in client details
            document.getElementById('client_name').value = client.name;
            document.getElementById('client_email').value = client.email || '';
            document.getElementById('client_phone').value = client.phone || '';
            
            // Close picker
            closeClientPicker();
            
            // Focus on next field
            document.getElementById('client_email').focus();
        }
        
        // Close modal when clicking outside
        document.getElementById('servicePicker')?.addEventListener('click', function(e) {
            if (e.target === this) {
                closeServicePicker();
            }
        });
        
        document.getElementById('clientPicker')?.addEventListener('click', function(e) {
            if (e.target === this) {
                closeClientPicker();
            }
        });

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

