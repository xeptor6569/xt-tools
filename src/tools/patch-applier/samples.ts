// Sample inputs for the "Try" buttons. logic.test.ts checks that they apply.

export const SAMPLE_ORIGINAL = `[server]
host = 127.0.0.1
port = 8080
workers = 2

[logging]
level = info
file = /var/log/app.log
`;

export const SAMPLE_PATCH = `diff --git a/config.ini b/config.ini
index 3b18e51..a1c4f02 100644
--- a/config.ini
+++ b/config.ini
@@ -1,7 +1,8 @@
 [server]
-host = 127.0.0.1
+host = 0.0.0.0
 port = 8080
-workers = 2
+workers = 4
+timeout = 30
 
 [logging]
 level = info
`;
