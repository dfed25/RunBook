# How to Load Runbook Extension in Chrome

## Step-by-Step:

1. **Open Chrome** (make sure you completely close and reopen it)

2. **Go to Extensions Page**
   - Type `chrome://extensions` in address bar
   - Press Enter

3. **Enable Developer Mode**
   - Look at top-right corner of the extensions page
   - Toggle "Developer mode" ON (blue toggle)

4. **Load Unpacked Extension**
   - Click blue button: "Load unpacked"
   - A file browser will open

5. **Select Extension Folder**
   - Navigate to: `C:\Users\bryan\Hackathons\RunBook\RunBook\public\extension`
   - Click "Select Folder"

6. **Wait for Load**
   - After a few seconds, "Runbook" should appear on the page with a purple icon

## Troubleshooting:

If you see an **error message** on the Runbook extension card:
- Click "Details" or "Errors"
- Screenshot the error
- Send it to me

If the extension **doesn't appear**:
1. Check address bar - make sure you're at `chrome://extensions`
2. Check Developer mode is ON (toggle should be blue)
3. Completely close Chrome and reopen it
4. Retry from step 2

## Test It:

1. Once loaded, visit: `http://localhost:3000/demo/github`
2. Look for purple button in bottom-right corner
3. Click it - task panel should open

---

**Extension files are ready.** The folder contains:
- manifest.json ✓
- content.js ✓
- background.js ✓
- widget.css ✓
