use serde::{Deserialize, Serialize};
use std::ffi::c_void;
use windows_sys::Win32::Foundation::{GetLastError, ERROR_NOT_FOUND};
use windows_sys::Win32::Security::Credentials::{
    CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE,
    CRED_TYPE_GENERIC,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyStatus {
    pub provider: String,
    pub has_key: bool,
    pub masked: Option<String>,
}

fn target_name_for(provider: &str) -> Vec<u16> {
    format!("mintu:api_key:{}", provider.trim().to_lowercase())
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect()
}

pub fn store_api_key(provider: &str, key: &str) -> Result<(), String> {
    let target = target_name_for(provider);
    let username: Vec<u16> = format!("mintu_{}", provider)
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    let key_bytes = key.trim().as_bytes();

    let cred = CREDENTIALW {
        Flags: 0,
        Type: CRED_TYPE_GENERIC,
        TargetName: target.as_ptr() as *mut u16,
        Comment: std::ptr::null_mut(),
        LastWritten: unsafe { std::mem::zeroed() },
        CredentialBlobSize: key_bytes.len() as u32,
        CredentialBlob: key_bytes.as_ptr() as *mut u8,
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        AttributeCount: 0,
        Attributes: std::ptr::null_mut(),
        TargetAlias: std::ptr::null_mut(),
        UserName: username.as_ptr() as *mut u16,
    };

    let ret = unsafe { CredWriteW(&cred, 0) };
    if ret != 0 {
        Ok(())
    } else {
        let err = unsafe { GetLastError() };
        Err(format!("Failed to store key in Windows Credential Manager (error code {})", err))
    }
}

pub fn get_api_key(provider: &str) -> Result<Option<String>, String> {
    let target = target_name_for(provider);
    let mut cred_ptr: *mut CREDENTIALW = std::ptr::null_mut();

    let ret = unsafe { CredReadW(target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut cred_ptr) };
    if ret != 0 && !cred_ptr.is_null() {
        let cred = unsafe { &*cred_ptr };
        let blob = unsafe {
            std::slice::from_raw_parts(cred.CredentialBlob, cred.CredentialBlobSize as usize)
        };
        let key_str = String::from_utf8(blob.to_vec()).map_err(|e| e.to_string())?;
        unsafe { CredFree(cred_ptr as *mut c_void) };
        Ok(Some(key_str))
    } else {
        let err = unsafe { GetLastError() };
        if err == ERROR_NOT_FOUND {
            Ok(None)
        } else {
            Err(format!("Failed to read key from Windows Credential Manager (error code {})", err))
        }
    }
}

pub fn delete_api_key(provider: &str) -> Result<bool, String> {
    let target = target_name_for(provider);
    let ret = unsafe { CredDeleteW(target.as_ptr(), CRED_TYPE_GENERIC, 0) };
    if ret != 0 {
        Ok(true)
    } else {
        let err = unsafe { GetLastError() };
        if err == ERROR_NOT_FOUND {
            Ok(false)
        } else {
            Err(format!("Failed to delete key from Windows Credential Manager (error code {})", err))
        }
    }
}

pub fn mask_key(key: &str) -> String {
    let trimmed = key.trim();
    if trimmed.len() <= 8 {
        return "••••••••".to_string();
    }
    let prefix = &trimmed[..4];
    let suffix = &trimmed[trimmed.len().saturating_sub(4)..];
    format!("{}••••{}", prefix, suffix)
}

pub fn get_key_status(provider: &str) -> KeyStatus {
    match get_api_key(provider) {
        Ok(Some(k)) => KeyStatus {
            provider: provider.to_string(),
            has_key: true,
            masked: Some(mask_key(&k)),
        },
        _ => KeyStatus {
            provider: provider.to_string(),
            has_key: false,
            masked: None,
        },
    }
}
