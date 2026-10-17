Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WinSearch2 {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet=CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll", CharSet=CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
}
'@

[WinSearch2]::EnumWindows({
    param($hwnd, $lparam)
    $sbTitle = New-Object System.Text.StringBuilder 256
    [WinSearch2]::GetWindowText($hwnd, $sbTitle, 256) | Out-Null
    $title = $sbTitle.ToString()
    if ($title -match "Mintu") {
        $pId = 0
        [WinSearch2]::GetWindowThreadProcessId($hwnd, [ref]$pId)
        $sbClass = New-Object System.Text.StringBuilder 256
        [WinSearch2]::GetClassName($hwnd, $sbClass, 256) | Out-Null
        $vis = [WinSearch2]::IsWindowVisible($hwnd)
        Write-Host "FOUND MINTU WINDOW -> HWND: $hwnd | PID: $pId | Visible: $vis | Class: $($sbClass.ToString()) | Title: $title"
    }
    return $true
}, [IntPtr]::Zero)
