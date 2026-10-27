<?php
// Simple test file to check if PHP is working and identify issues
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>BetaDeck Invoice System - Test Page</h1>";
echo "<hr>";

// Check PHP version
echo "<h2>PHP Information</h2>";
echo "<p><strong>PHP Version:</strong> " . phpversion() . "</p>";
echo "<p><strong>Server Software:</strong> " . ($_SERVER['SERVER_SOFTWARE'] ?? 'Unknown') . "</p>";

// Check if session works
echo "<h2>Session Test</h2>";
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
echo "<p><strong>Session Status:</strong> " . (session_status() === PHP_SESSION_ACTIVE ? "Active" : "Not Active") . "</p>";
echo "<p><strong>Session ID:</strong> " . session_id() . "</p>";

// Check directory permissions
echo "<h2>Directory Permissions</h2>";
$invoicesDir = __DIR__ . '/data';
echo "<p><strong>Data Directory:</strong> " . $invoicesDir . "</p>";
echo "<p><strong>Directory Exists:</strong> " . (is_dir($invoicesDir) ? "Yes" : "No") . "</p>";
if (is_dir($invoicesDir)) {
    echo "<p><strong>Directory Readable:</strong> " . (is_readable($invoicesDir) ? "Yes" : "No") . "</p>";
    echo "<p><strong>Directory Writable:</strong> " . (is_writable($invoicesDir) ? "Yes" : "No") . "</p>";
} else {
    echo "<p><strong>Attempting to create directory...</strong> ";
    if (mkdir($invoicesDir, 0755, true)) {
        echo "Success!</p>";
    } else {
        echo "Failed! Please create the 'data' folder manually with 755 permissions.</p>";
    }
}

// Check file permissions
echo "<h2>File Permissions</h2>";
$files = ['index.php', 'login.php', 'create.php', 'view.php', 'send.php', 'invoice.php'];
foreach ($files as $file) {
    $path = __DIR__ . '/' . $file;
    echo "<p><strong>$file:</strong> " . (file_exists($path) ? "Exists" : "Missing") . "</p>";
}

// Check JSON files
echo "<h2>JSON Configuration Files</h2>";
$jsonFiles = ['services.json', 'clients.json', 'exchange_rates.json', 'payment_details.json'];
foreach ($jsonFiles as $file) {
    $path = __DIR__ . '/' . $file;
    if (file_exists($path)) {
        $content = @file_get_contents($path);
        $data = @json_decode($content, true);
        echo "<p><strong>$file:</strong> " . (is_array($data) ? "Valid JSON" : "Invalid JSON or empty") . "</p>";
    } else {
        echo "<p><strong>$file:</strong> Missing</p>";
    }
}

// Test glob function
echo "<h2>Invoice Files Test</h2>";
if (is_dir($invoicesDir) && is_readable($invoicesDir)) {
    $files = glob($invoicesDir . '/invoice_*.json');
    echo "<p><strong>Invoice Files Found:</strong> " . count($files) . "</p>";
    if (count($files) > 0) {
        echo "<ul>";
        foreach (array_slice($files, 0, 5) as $file) {
            echo "<li>" . basename($file) . "</li>";
        }
        echo "</ul>";
    }
} else {
    echo "<p><strong>Error:</strong> Cannot read invoice directory</p>";
}

// Check for common PHP functions
echo "<h2>PHP Functions Check</h2>";
$functions = ['json_decode', 'json_encode', 'file_get_contents', 'file_put_contents', 'glob', 'mkdir'];
foreach ($functions as $func) {
    echo "<p><strong>$func:</strong> " . (function_exists($func) ? "Available" : "Not Available") . "</p>";
}

echo "<hr>";
echo "<p><a href='login.php'>Go to Login Page</a></p>";
echo "<p><a href='index.php'>Go to Index Page</a></p>";
?>

