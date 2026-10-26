$ErrorActionPreference = "Stop"

$BUILD_DIR = "C:\Users\Administrator\.gemini\antigravity\scratch\face-detect-native-android"
$SDK_DIR = "C:\Users\Administrator\AppData\Local\Android\Sdk"
$BUILD_TOOLS = "$SDK_DIR\build-tools\36.0.0"
$PLATFORM_JAR = "$SDK_DIR\platforms\android-37.0\android.jar"
$JDK_DIR = "C:\Users\Administrator\.gemini\antigravity\scratch\jdk17\jdk-17.0.10+7"

$env:JAVA_HOME = $JDK_DIR
$env:Path = "$JDK_DIR\bin;$BUILD_TOOLS;$env:Path"

Set-Location $BUILD_DIR

Write-Host "--- 1. Compiling Resources (aapt2 compile) ---"
if (Test-Path "compiled_res.zip") { Remove-Item "compiled_res.zip" -Force }
& "$BUILD_TOOLS\aapt2.exe" compile --dir res -o compiled_res.zip

Write-Host "--- 2. Linking Manifest (aapt2 link) ---"
if (Test-Path "base.apk") { Remove-Item "base.apk" -Force }
# Also generate R.java
New-Item -ItemType Directory -Path "gen" -Force | Out-Null
& "$BUILD_TOOLS\aapt2.exe" link -o base.apk -I $PLATFORM_JAR --manifest AndroidManifest.xml compiled_res.zip --java gen --auto-add-overlay

Write-Host "--- 3. Compiling Java Source (javac) ---"
if (Test-Path "bin") { Remove-Item "bin" -Recurse -Force }
New-Item -ItemType Directory -Path "bin\classes" -Force | Out-Null
New-Item -ItemType Directory -Path "bin\dex" -Force | Out-Null

$javaFiles = Get-ChildItem -Path "src\*.java", "gen\*.java" -Recurse | ForEach-Object { $_.FullName }
& "$JDK_DIR\bin\javac.exe" -source 1.8 -target 1.8 -cp $PLATFORM_JAR -d "bin\classes" $javaFiles

Write-Host "--- 4. Generating DEX (d8) ---"
$classFiles = Get-ChildItem -Path "bin\classes" -Recurse -Filter "*.class" | ForEach-Object { $_.FullName }
& cmd.exe /c "d8.bat --output bin\dex --lib `"$PLATFORM_JAR`" $($classFiles -join ' ')"

Write-Host "--- 5. Packaging classes.dex into APK ---"
& "$JDK_DIR\bin\jar.exe" -uf base.apk -C bin\dex classes.dex

Write-Host "--- 6. Aligning APK (zipalign) ---"
if (Test-Path "aligned.apk") { Remove-Item "aligned.apk" -Force }
& "$BUILD_TOOLS\zipalign.exe" -p -f 4 base.apk aligned.apk

Write-Host "--- 7. Generating Debug Keystore ---"
if (-not (Test-Path "debug.keystore")) {
    & "$JDK_DIR\bin\keytool.exe" -genkey -v -keystore debug.keystore -alias androiddebugkey -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
}

Write-Host "--- 8. Signing APK (apksigner) ---"
$FINAL_APK = "C:\Users\Administrator\.gemini\antigravity\scratch\FaceCount-Native.apk"
if (Test-Path $FINAL_APK) { Remove-Item $FINAL_APK -Force }
& cmd.exe /c "apksigner.bat sign --ks debug.keystore --ks-pass pass:android --key-pass pass:android --out `"$FINAL_APK`" aligned.apk"

# Also copy to face-detect-phone-app directory so the existing web server can serve it directly!
Copy-Item $FINAL_APK "C:\Users\Administrator\.gemini\antigravity\scratch\face-detect-phone-app\FaceCount-Native.apk" -Force

Write-Host "`n=================================================="
Write-Host "  SUCCESS! Native Android Face Detection APK built:"
Write-Host "  Path: $FINAL_APK"
Write-Host "  Size: $((Get-Item $FINAL_APK).Length) bytes"
Write-Host "=================================================="
