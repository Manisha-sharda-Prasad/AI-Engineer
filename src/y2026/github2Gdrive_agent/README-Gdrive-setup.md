 Google drive access setup steps
You are on **Step 1 of creating the Service Account**. Follow these quick steps to finish creation and download your JSON key file:

---

### Step 1: Complete the Creation Wizard
1. Enter a **Service account name** (e.g., `gdrive-backup-agent`).
2. Click **CREATE AND CONTINUE** at the bottom.
3. Step 2 & Step 3 are optional — click **DONE** at the bottom.

---

### Step 2: Generate & Download the JSON Key File
1. You will be taken back to the **Service accounts** list table.
2. Click on your newly created service account's **Email address** (e.g., `gdrive-backup-agent@agents-2026-502600.iam.gserviceaccount.com`).
3. Click the **KEYS** tab at the top.
4. Click **ADD KEY ➔ Create new key**.
5. Select **JSON** and click **CREATE**.
6. A `.json` file will automatically download to your computer!

---

### Step 3: Grant Access in Google Drive
1. Copy the Service Account Email address (`gdrive-backup-agent@agents-2026-502600.iam.gserviceaccount.com`).
2. Open [Google Drive](https://drive.google.com) in your browser.
3. Right-click the folder where you want your backups saved (or your root backup folder), click **Share**.
4. Paste the Service Account Email address, set role to **Editor**, and click **Send / Share**.

---

### Step 4: Upload to the Agent
- Open the Web Dashboard at **[http://localhost:8000](http://localhost:8000)** (or `http://localhost:3000`).
- Click **⚙️ Drive Settings**.
- Select **🔑 Google Service Account** mode and upload your downloaded `.json` key file!