//! Windows adapter for active window detection.
//!
//! Uses Win32 APIs to obtain the foreground window's process name and title:
//!   1. `GetForegroundWindow()` — handle to the current foreground window
//!   2. `GetWindowThreadProcessId()` — maps window handle to process ID
//!   3. `OpenProcess()` — opens the process with PROCESS_QUERY_LIMITED_INFORMATION
//!   4. `QueryFullProcessImageNameW()` — reads the full exe path from the process
//!   5. `GetWindowTextW()` — reads the window title string
//!
//! `QueryFullProcessImageNameW` is used instead of `GetModuleFileNameExW` because
//! it works correctly with `PROCESS_QUERY_LIMITED_INFORMATION`. The older
//! `GetModuleFileNameExW` requires `PROCESS_QUERY_INFORMATION | PROCESS_VM_READ`,
//! which is unavailable for protected or elevated processes on standard user accounts.
//!
//! The exe path is split on `\` to extract just the file name, and the `.exe`
//! suffix is stripped for consistency with process names on macOS.

#[cfg(target_os = "windows")]

use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use std::path::Path;

use windows::Win32::Foundation::{CloseHandle, HWND};
use windows::Win32::System::Threading::{
  OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
  PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::WindowsAndMessaging::{
  GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
};

use super::ActiveWindowData;

pub fn get_active_window() -> Option<ActiveWindowData> {
  unsafe {
    // Step 1: Get the foreground window handle.
    // Returns a null HWND if no window is in the foreground (e.g. during login screen).
    let hwnd: HWND = GetForegroundWindow();
    if hwnd.0 == 0 {
      return None;
    }

    // Step 2: Get the PID that owns the foreground window.
    let mut pid: u32 = 0;
    GetWindowThreadProcessId(hwnd, Some(&mut pid));
    if pid == 0 {
      return None;
    }

    // Step 3: Open the process. PROCESS_QUERY_LIMITED_INFORMATION is sufficient
    // for QueryFullProcessImageNameW and avoids UAC elevation prompts for
    // protected processes. Unlike GetModuleFileNameExW, this API does not
    // require PROCESS_VM_READ.
    let process_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;

    // Step 4: Get the full executable path using QueryFullProcessImageNameW.
    // buf_len is an in/out parameter: in = buffer size, out = chars written.
    let mut buf_len: u32 = 1024;
    let mut exe_path_buf = vec![0u16; buf_len as usize];
    let ok = QueryFullProcessImageNameW(
      process_handle,
      PROCESS_NAME_WIN32,
      windows::core::PWSTR(exe_path_buf.as_mut_ptr()),
      &mut buf_len,
    );

    // Close the handle regardless of whether we got a path.
    let _ = CloseHandle(process_handle);

    let process_name = if ok.is_ok() && buf_len > 0 {
      let path_os = OsString::from_wide(&exe_path_buf[..buf_len as usize]);
      let path = Path::new(&path_os);
      // Extract the file stem (name without extension) for normalization.
      // e.g. "C:\Program Files\...\Code.exe" → "Code"
      path
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_owned())
        .unwrap_or_default()
    } else {
      String::new()
    };

    if process_name.is_empty() {
      return None;
    }

    // Step 5: Get the window title.
    let mut title_buf = vec![0u16; 512];
    let title_len = GetWindowTextW(hwnd, &mut title_buf);
    let window_title = if title_len > 0 {
      OsString::from_wide(&title_buf[..title_len as usize])
        .to_string_lossy()
        .into_owned()
    } else {
      String::new()
    };

    Some(ActiveWindowData {
      process_name,
      window_title,
      bundle_id: None, // Windows does not have bundle identifiers
    })
  }
}
