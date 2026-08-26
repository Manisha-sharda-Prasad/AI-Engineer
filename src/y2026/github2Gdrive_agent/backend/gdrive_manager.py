import os
import json
import hashlib
from pathlib import Path
from typing import Dict, Optional, List, Tuple
from src.y2026.github2Gdrive_agent.backend.config import CREDENTIALS_FILE
from src.y2026.github2Gdrive_agent.backend.models import GDriveConfig

class GDriveManager:
    def __init__(self, config: GDriveConfig):
        self.config = config

    def _get_gdrive_service(self):
        """Build Google Drive API client service if google apis are available."""
        try:
            from googleapiclient.discovery import build
            from google.oauth2 import service_account

            if self.config.service_account_json:
                sa_info = json.loads(self.config.service_account_json)
                creds = service_account.Credentials.from_service_account_info(
                    sa_info, scopes=['https://www.googleapis.com/auth/drive']
                )
                return build('drive', 'v3', credentials=creds)
            elif CREDENTIALS_FILE.exists():
                creds = service_account.Credentials.from_service_account_file(
                    str(CREDENTIALS_FILE), scopes=['https://www.googleapis.com/auth/drive']
                )
                return build('drive', 'v3', credentials=creds)
        except Exception:
            return None
        return None

    async def get_or_create_folder(self, folder_name: str, parent_id: Optional[str] = None) -> Tuple[str, List[str]]:
        """
        Creates or retrieves a target Google Drive folder via Google Drive API.
        """
        logs = []
        service = self._get_gdrive_service()
        if not service:
            raise RuntimeError(
                "Google Service Account credentials missing or invalid. Please upload your Service Account JSON key."
            )

        logs.append(f"[GoogleDrive:API] Checking folder '{folder_name}' via Google Drive API")
        query = f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        if parent_id:
            query += f" and '{parent_id}' in parents"

        response = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        files = response.get('files', [])
        if files:
            folder_id = files[0]['id']
            logs.append(f"[GoogleDrive:API] Found existing folder '{folder_name}' (ID: {folder_id})")
            return folder_id, logs

        file_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder'
        }
        if parent_id:
            file_metadata['parents'] = [parent_id]

        folder = service.files().create(body=file_metadata, fields='id').execute()
        folder_id = folder.get('id')
        logs.append(f"[GoogleDrive:API] Created folder '{folder_name}' (ID: {folder_id})")
        return folder_id, logs

    async def list_remote_files(self, folder_id: str) -> Dict[str, Dict]:
        """
        Lists files currently backed up in Google Drive folder.
        Returns a dict mapping relative_path -> file metadata (id, hash, size).
        """
        service = self._get_gdrive_service()
        if not service:
            return {}

        try:
            result = {}
            query = f"'{folder_id}' in parents and trashed = false"
            response = service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name, md5Checksum, size, description)'
            ).execute()
            for f in response.get('files', []):
                rel_path = f.get('description', f['name'])
                result[rel_path] = {
                    "id": f['id'],
                    "name": f['name'],
                    "hash": f.get('md5Checksum', ''),
                    "size": int(f.get('size', 0))
                }
            return result
        except Exception:
            return {}

    async def upload_file(self, repo_name: str, folder_id: str, relative_path: str, content: bytes, content_hash: str) -> Tuple[str, List[str]]:
        """
        Uploads or updates a file in Google Drive.
        """
        logs = []
        service = self._get_gdrive_service()
        if not service:
            raise RuntimeError(
                "Google Service Account credentials missing or invalid. Please upload your Service Account JSON key."
            )

        from googleapiclient.http import MediaInMemoryUpload

        filename = Path(relative_path).name
        file_metadata = {
            'name': filename,
            'parents': [folder_id],
            'description': relative_path
        }
        media = MediaInMemoryUpload(content, resumable=True)
        uploaded_file = service.files().create(
            body=file_metadata, media_body=media, fields='id'
        ).execute()
        file_id = uploaded_file.get('id')
        logs.append(f"[GoogleDrive:API] Uploaded '{relative_path}' ({len(content)} bytes) to Google Drive -> ID: {file_id}")
        return file_id, logs
