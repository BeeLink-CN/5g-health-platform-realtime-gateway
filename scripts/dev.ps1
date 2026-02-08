# Auto-select available port and start gateway
param(
    [int]$PreferredPort = 8080,
    [string]$NatsUrl = "nats://localhost:4222",
    [string]$NatsStream = "events",
    [string]$NatsDurable = "realtime-gateway-dev",
    [string]$ContractsPath = "./contracts"
)

Write-Host "🚀 Starting 5G Real-time Gateway..." -ForegroundColor Cyan
Write-Host ""

# Function to check if port is available
function Test-Port {
    param([int]$Port)
    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
        $listener.Start()
        $listener.Stop()
        return $true
    }
    catch {
        return $false
    }
    finally {
        if ($listener) { $listener.Stop() }
    }
}

# Find available port
$port = $PreferredPort
$maxAttempts = 10
$attempt = 0

while (-not (Test-Port $port) -and $attempt -lt $maxAttempts) {
    Write-Host "⚠️  Port $port is busy, trying $($port + 1)..." -ForegroundColor Yellow
    $port++
    $attempt++
}

if ($attempt -eq $maxAttempts) {
    Write-Host "❌ Could not find available port in range $PreferredPort-$($PreferredPort + $maxAttempts)" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Using port: $port" -ForegroundColor Green

# Check NATS connectivity
Write-Host "🔍 Checking NATS connectivity..." -ForegroundColor Cyan
$natsHost = $NatsUrl -replace "nats://", "" -replace ":\d+$", ""
$natsPort = if ($NatsUrl -match ":(\d+)") { $matches[1] } else { "4222" }

try {
    $tcpTest = Test-NetConnection -ComputerName $natsHost.Split(":")[0] -Port $natsPort -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($tcpTest) {
        Write-Host "✅ NATS is reachable at $natsHost:$natsPort" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  NATS not reachable at $natsHost:$natsPort" -ForegroundColor Yellow
        Write-Host "   Gateway will retry connection..." -ForegroundColor Yellow
    }
}
catch {
    Write-Host "⚠️  Could not test NATS connectivity" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 Configuration:" -ForegroundColor Cyan
Write-Host "   SERVICE_PORT: $port"
Write-Host "   NATS_URL: $NatsUrl"
Write-Host "   NATS_STREAM: $NatsStream"
Write-Host "   NATS_DURABLE: $NatsDurable"
Write-Host "   CONTRACTS_PATH: $ContractsPath"
Write-Host ""

# Set environment variables and start
$env:SERVICE_PORT = $port
$env:NATS_URL = $NatsUrl
$env:NATS_STREAM = $NatsStream
$env:NATS_DURABLE = $NatsDurable
$env:CONTRACTS_PATH = $ContractsPath
$env:NODE_ENV = "development"

Write-Host "🎯 Starting gateway..." -ForegroundColor Cyan
Write-Host "   Health: http://localhost:$port/health" -ForegroundColor Gray
Write-Host "   Ready: http://localhost:$port/ready" -ForegroundColor Gray
Write-Host "   WebSocket: ws://localhost:$port/ws" -ForegroundColor Gray
Write-Host ""

npm run dev
