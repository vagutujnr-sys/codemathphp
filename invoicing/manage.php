<?php
session_start();

if (!isset($_SESSION['invoicing_logged_in']) || $_SESSION['invoicing_logged_in'] !== true) {
    header('Location: login.php');
    exit;
}

$page = $_GET['page'] ?? 'clients';
$success = '';
$error = '';

// Handle form submissions
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($page === 'clients') {
        $action = $_POST['action'] ?? '';
        if ($action === 'add') {
            $clientsFile = __DIR__ . '/clients.json';
            $clients = json_decode(file_get_contents($clientsFile), true);
            $newId = max(array_column($clients['clients'], 'id')) + 1;
            $clients['clients'][] = [
                'id' => $newId,
                'name' => trim($_POST['name'] ?? ''),
                'email' => trim($_POST['email'] ?? ''),
                'phone' => trim($_POST['phone'] ?? ''),
                'company' => trim($_POST['company'] ?? ''),
                'notes' => trim($_POST['notes'] ?? '')
            ];
            file_put_contents($clientsFile, json_encode($clients, JSON_PRETTY_PRINT));
            $success = 'Client added successfully';
        } elseif ($action === 'delete') {
            $clientsFile = __DIR__ . '/clients.json';
            $clients = json_decode(file_get_contents($clientsFile), true);
            $id = intval($_POST['id'] ?? 0);
            $clients['clients'] = array_filter($clients['clients'], fn($c) => $c['id'] !== $id);
            $clients['clients'] = array_values($clients['clients']);
            file_put_contents($clientsFile, json_encode($clients, JSON_PRETTY_PRINT));
            $success = 'Client deleted successfully';
        }
    } elseif ($page === 'exchange_rates') {
        $ratesFile = __DIR__ . '/exchange_rates.json';
        $rates = json_decode(file_get_contents($ratesFile), true);
        $rates['rates']['USD'] = floatval($_POST['usd'] ?? 0.055);
        $rates['rates']['EUR'] = floatval($_POST['eur'] ?? 0.050);
        $rates['rates']['GBP'] = floatval($_POST['gbp'] ?? 0.043);
        $rates['last_updated'] = date('Y-m-d');
        file_put_contents($ratesFile, json_encode($rates, JSON_PRETTY_PRINT));
        $success = 'Exchange rates updated successfully';
    }
}

// Load data
$clientsFile = __DIR__ . '/clients.json';
$clients = json_decode(file_get_contents($clientsFile), true)['clients'] ?? [];

$ratesFile = __DIR__ . '/exchange_rates.json';
$rates = json_decode(file_get_contents($ratesFile), true);

$servicesFile = __DIR__ . '/services.json';
$services = json_decode(file_get_contents($servicesFile), true)['services'] ?? [];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="theme-color" content="#FF8C00">
    <link rel="manifest" href="manifest.json">
    <title>Manage - CodemathPHP Invoice</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 0;
            -webkit-font-smoothing: antialiased;
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
            padding: 1.25rem 1rem;
            background: linear-gradient(135deg, #FF8C00, #FF6B35);
            color: white;
        }
        .drawer-header h2 {
            font-size: 1.1rem;
            margin-bottom: 0.25rem;
            font-weight: 700;
        }
        .drawer-header p {
            font-size: 0.75rem;
            opacity: 0.9;
        }
        .drawer-menu {
            list-style: none;
            padding: 0.5rem 0;
        }
        .drawer-menu li a {
            display: flex;
            align-items: center;
            padding: 0.85rem 1rem;
            color: #1a1a1a;
            text-decoration: none;
            border-bottom: 1px solid #f0f0f0;
            transition: all 0.2s;
            font-size: 0.95rem;
        }
        .drawer-menu li a:hover,
        .drawer-menu li a.active {
            background: #f8f9fa;
            color: #FF8C00;
            padding-left: 1.25rem;
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
        .header {
            background: white;
            padding: 0.85rem 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .header h1 {
            font-size: 1.1rem;
            font-weight: 600;
            flex: 1;
            margin: 0 0.75rem;
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
        .content {
            padding: 1rem;
            max-width: 800px;
            margin: 0 auto;
        }
        .card {
            background: white;
            border-radius: 12px;
            padding: 1.25rem;
            margin-bottom: 1rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .card h2 {
            font-size: 1.15rem;
            margin-bottom: 0.75rem;
            font-weight: 700;
        }
        .btn {
            padding: 0.75rem 1.5rem;
            background: linear-gradient(135deg, #FF8C00, #FF6B35);
            color: white;
            border: none;
            border-radius: 12px;
            font-weight: 600;
            cursor: pointer;
            min-height: 44px;
        }
        .btn-secondary {
            background: #6c757d;
        }
        .form-group {
            margin-bottom: 0.85rem;
        }
        label {
            display: block;
            margin-bottom: 0.4rem;
            font-weight: 600;
            font-size: 0.9rem;
        }
        input, textarea {
            width: 100%;
            padding: 0.65rem;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 0.95rem;
        }
        .table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
        }
        .table th, .table td {
            padding: 0.6rem 0.5rem;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        .table th {
            font-weight: 600;
            background: #f8f9fa;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        .table-responsive {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            margin: 0 -1.25rem;
            padding: 0 1.25rem;
        }
        .table-responsive table {
            min-width: 600px;
        }
        @media (max-width: 768px) {
            .table {
                display: block;
                width: 100%;
            }
            .table thead {
                display: none;
            }
            .table tbody {
                display: block;
            }
            .table tr {
                display: block;
                margin-bottom: 1rem;
                background: #f8f9fa;
                border-radius: 8px;
                padding: 0.75rem;
                border: 1px solid #e0e0e0;
            }
            .table td {
                display: block;
                padding: 0.5rem 0;
                text-align: right;
                border-bottom: 1px solid #e0e0e0;
            }
            .table td:before {
                content: attr(data-label);
                float: left;
                font-weight: 600;
                color: #6c757d;
                font-size: 0.85rem;
            }
            .table td:last-child {
                border-bottom: none;
            }
        }
        .alert {
            padding: 1rem;
            border-radius: 12px;
            margin-bottom: 1rem;
        }
        .alert-success {
            background: #d4edda;
            color: #155724;
        }
        .alert-error {
            background: #fee;
            color: #c0392b;
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
            <li><a href="manage.php?page=clients" class="<?php echo $page === 'clients' ? 'active' : ''; ?>">- Clients</a></li>
            <li><a href="manage.php?page=services" class="<?php echo $page === 'services' ? 'active' : ''; ?>">- Services</a></li>
            <li><a href="manage.php?page=exchange_rates" class="<?php echo $page === 'exchange_rates' ? 'active' : ''; ?>">- Rates</a></li>
            <li><a href="login.php?logout=1">- Logout</a></li>
        </ul>
    </div>

    <div class="header">
        <button class="menu-btn" onclick="toggleDrawer()">☰</button>
        <h1><?php echo ucfirst(str_replace('_', ' ', $page)); ?></h1>
        <a href="index.php" class="btn btn-secondary" style="padding: 0.5rem 0.85rem; font-size: 0.8rem; text-decoration: none;">Back</a>
    </div>

    <div class="content">
        <?php if ($success): ?>
            <div class="alert alert-success"><?php echo htmlspecialchars($success); ?></div>
        <?php endif; ?>
        <?php if ($error): ?>
            <div class="alert alert-error"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>

        <?php if ($page === 'clients'): ?>
            <div class="card">
                <h2>Add Client</h2>
                <form method="post">
                    <input type="hidden" name="action" value="add">
                    <div class="form-group">
                        <label>Name *</label>
                        <input type="text" name="name" required>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email">
                    </div>
                    <div class="form-group">
                        <label>Phone</label>
                        <input type="tel" name="phone">
                    </div>
                    <div class="form-group">
                        <label>Company</label>
                        <input type="text" name="company">
                    </div>
                    <div class="form-group">
                        <label>Notes</label>
                        <textarea name="notes" rows="2"></textarea>
                    </div>
                    <button type="submit" class="btn">Add Client</button>
                </form>
            </div>

            <div class="card">
                <h2>Clients (<?php echo count($clients); ?>)</h2>
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Company</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($clients as $client): ?>
                                <tr>
                                    <td data-label="Name"><?php echo htmlspecialchars($client['name']); ?></td>
                                    <td data-label="Email"><?php echo htmlspecialchars($client['email'] ?? '-'); ?></td>
                                    <td data-label="Company"><?php echo htmlspecialchars($client['company'] ?? '-'); ?></td>
                                    <td data-label="Actions">
                                        <form method="post" style="display: inline;" onsubmit="return confirm('Delete this client?');">
                                            <input type="hidden" name="action" value="delete">
                                            <input type="hidden" name="id" value="<?php echo $client['id']; ?>">
                                            <button type="submit" style="background: #dc3545; color: white; border: none; padding: 0.4rem 0.75rem; border-radius: 8px; cursor: pointer; font-size: 0.85rem;">Delete</button>
                                        </form>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>

        <?php elseif ($page === 'exchange_rates'): ?>
            <div class="card">
                <h2 style="margin-bottom: 1rem;">Exchange Rates</h2>
                <p style="color: #6c757d; margin-bottom: 1rem;">Rates are relative to ZAR (1 ZAR = X Currency)</p>
                <form method="post">
                    <div class="form-group">
                        <label>USD Rate (1 ZAR = ? USD)</label>
                        <input type="number" name="usd" step="0.0001" value="<?php echo $rates['rates']['USD'] ?? 0.055; ?>" required>
                    </div>
                    <div class="form-group">
                        <label>EUR Rate (1 ZAR = ? EUR)</label>
                        <input type="number" name="eur" step="0.0001" value="<?php echo $rates['rates']['EUR'] ?? 0.050; ?>" required>
                    </div>
                    <div class="form-group">
                        <label>GBP Rate (1 ZAR = ? GBP)</label>
                        <input type="number" name="gbp" step="0.0001" value="<?php echo $rates['rates']['GBP'] ?? 0.043; ?>" required>
                    </div>
                    <button type="submit" class="btn">Update Rates</button>
                </form>
                <?php if (!empty($rates['last_updated'])): ?>
                    <p style="margin-top: 1rem; color: #6c757d; font-size: 0.85rem;">Last updated: <?php echo $rates['last_updated']; ?></p>
                <?php endif; ?>
            </div>

        <?php elseif ($page === 'services'): ?>
            <div class="card">
                <h2>Services (<?php echo count($services); ?>)</h2>
                <p style="color: #6c757d; margin-bottom: 1rem; font-size: 0.85rem;">Edit services.json file directly to manage services.</p>
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Price (ZAR)</th>
                                <th>Category</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($services as $service): ?>
                                <tr>
                                    <td data-label="Name"><?php echo htmlspecialchars($service['name']); ?></td>
                                    <td data-label="Price">R <?php echo number_format($service['price'], 2); ?></td>
                                    <td data-label="Category"><?php echo htmlspecialchars($service['category'] ?? '-'); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        <?php endif; ?>
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

