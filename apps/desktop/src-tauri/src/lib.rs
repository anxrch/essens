use std::sync::Mutex;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

struct SidecarState {
    child: Mutex<Option<CommandChild>>,
}

#[tauri::command]
fn rpc_call(state: tauri::State<'_, SidecarState>, request: String) -> Result<(), String> {
    let mut guard = state.child.lock().map_err(|e| e.to_string())?;
    if let Some(child) = guard.as_mut() {
        let msg = format!("{}\n", request);
        child.write(msg.as_bytes()).map_err(|e| e.to_string())?;
    } else {
        return Err("Sidecar not running".into());
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![rpc_call])
        .setup(|app| {
            // Open devtools in debug builds
            #[cfg(debug_assertions)]
            if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
            }

            let shell = app.shell();
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");

            // Ensure data directory exists
            std::fs::create_dir_all(&data_dir).ok();

            let sidecar_command = shell
                .sidecar("essens-sidecar")
                .expect("failed to create sidecar command")
                .args([data_dir.to_str().unwrap()]);

            let (mut rx, child) = sidecar_command
                .spawn()
                .expect("failed to spawn sidecar");

            app.manage(SidecarState {
                child: Mutex::new(Some(child)),
            });

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            let line_str = String::from_utf8_lossy(&line);
                            app_handle.emit("sidecar-stdout", line_str.to_string()).ok();
                        }
                        CommandEvent::Stderr(line) => {
                            let line_str = String::from_utf8_lossy(&line);
                            eprintln!("[sidecar stderr] {}", line_str);
                        }
                        CommandEvent::Terminated(status) => {
                            eprintln!("[sidecar] terminated with {:?}", status);
                            break;
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
