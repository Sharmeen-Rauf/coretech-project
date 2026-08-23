Add-Type -AssemblyName System.Drawing

$sourceJpg = "C:\Users\Muneef Rauf\.gemini\antigravity-ide\brain\e986d7ea-0dbc-4c21-8866-ee4787990d1e\icon_1787294192176.jpg"
$assetsDir = "C:\Users\Muneef Rauf\Pictures\coretech-project\coretech-mobile\assets"

if (-not (Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Path $assetsDir -Force
}

$targets = @("icon.png", "adaptive-icon.png", "favicon.png", "splash.png")

foreach ($target in $targets) {
    $destPng = Join-Path $assetsDir $target
    
    # Load the JPG image
    $img = [System.Drawing.Image]::FromFile($sourceJpg)
    
    # Save it as PNG
    $img.Save($destPng, [System.Drawing.Imaging.ImageFormat]::Png)
    $img.Dispose()
    
    Write-Host "Successfully converted and saved: $destPng"
}
