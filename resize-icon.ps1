Add-Type -AssemblyName System.Drawing

$originalPath = "public/icon.png"
$img = [System.Drawing.Image]::FromFile((Resolve-Path $originalPath))

Write-Host "Original size: $($img.Width)x$($img.Height) pixels"
Write-Host "Original file size: $((Get-Item $originalPath).Length) bytes"

# Create 32x32 favicon
$bitmap32 = New-Object System.Drawing.Bitmap(32, 32)
$graphics32 = [System.Drawing.Graphics]::FromImage($bitmap32)
$graphics32.DrawImage($img, 0, 0, 32, 32)
$bitmap32.Save("public/favicon-32x32.png", [System.Drawing.Imaging.ImageFormat]::Png)
$graphics32.Dispose()
$bitmap32.Dispose()
Write-Host "Created favicon-32x32.png"

# Create 16x16 favicon
$bitmap16 = New-Object System.Drawing.Bitmap(16, 16)
$graphics16 = [System.Drawing.Graphics]::FromImage($bitmap16)
$graphics16.DrawImage($img, 0, 0, 16, 16)
$bitmap16.Save("public/favicon-16x16.png", [System.Drawing.Imaging.ImageFormat]::Png)
$graphics16.Dispose()
$bitmap16.Dispose()
Write-Host "Created favicon-16x16.png"

# Create 192x192 for Apple
$bitmap192 = New-Object System.Drawing.Bitmap(192, 192)
$graphics192 = [System.Drawing.Graphics]::FromImage($bitmap192)
$graphics192.DrawImage($img, 0, 0, 192, 192)
$bitmap192.Save("public/apple-touch-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$graphics192.Dispose()
$bitmap192.Dispose()
Write-Host "Created apple-touch-icon.png"

$img.Dispose()

# Copy to app folder
Copy-Item "public/favicon-32x32.png" "src/app/favicon.ico"
Write-Host "Copied to src/app/favicon.ico"
