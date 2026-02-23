pub mod agents;
pub mod files;
pub mod notifications;
pub mod settings;

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Central.", name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn greet_includes_name() {
        let result = greet("Alice");
        assert_eq!(result, "Hello, Alice! Welcome to Central.");
    }

    #[test]
    fn greet_handles_empty_name() {
        let result = greet("");
        assert_eq!(result, "Hello, ! Welcome to Central.");
    }
}
