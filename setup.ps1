# Setup script for Windows
Write-Host "Setting up Real-Time Personality Engine..." -ForegroundColor Cyan

# Check Python
Write-Host "`nChecking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found. Please install Python 3.9+" -ForegroundColor Red
    exit 1
}

# Check Node.js
Write-Host "`nChecking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "✓ Found Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js 16+" -ForegroundColor Red
    exit 1
}

# Setup Backend
Write-Host "`n=== Setting up Backend ===" -ForegroundColor Cyan
Set-Location backend

Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
python -m pip install --upgrade pip
pip install -r requirements.txt

Write-Host "`n✓ Backend setup complete!" -ForegroundColor Green

# Check for .env file
if (-Not (Test-Path ".env")) {
    Write-Host "`n⚠️  Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "Please edit backend/.env and add your API keys:" -ForegroundColor Yellow
    Write-Host "  - GROQ_API_KEY (get from https://console.groq.com)" -ForegroundColor Yellow
    Write-Host "  - HF_API_TOKEN (get from https://huggingface.co/settings/tokens)" -ForegroundColor Yellow
}

Set-Location ..

# Setup Frontend
Write-Host "`n=== Setting up Frontend ===" -ForegroundColor Cyan
Set-Location frontend

Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
npm install

Write-Host "`n✓ Frontend setup complete!" -ForegroundColor Green

Set-Location ..

# Final instructions
Write-Host "`n=== Setup Complete! ===" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Add your API keys to backend/.env" -ForegroundColor White
Write-Host "   - GROQ_API_KEY: https://console.groq.com" -ForegroundColor White
Write-Host "   - HF_API_TOKEN: https://huggingface.co/settings/tokens" -ForegroundColor White
Write-Host "`n2. Start the backend:" -ForegroundColor White
Write-Host "   cd backend" -ForegroundColor Yellow
Write-Host "   uvicorn main:app --reload" -ForegroundColor Yellow
Write-Host "`n3. In a new terminal, start the frontend:" -ForegroundColor White
Write-Host "   cd frontend" -ForegroundColor Yellow
Write-Host "   npm run dev" -ForegroundColor Yellow
Write-Host "`n4. Open http://localhost:5173 in your browser" -ForegroundColor White
Write-Host "`nEnjoy your Real-Time Personality Engine! 🚀" -ForegroundColor Green
