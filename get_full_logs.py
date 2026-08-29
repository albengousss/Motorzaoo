import urllib.request
import json
import sys
import zipfile
import io

url = "https://api.github.com/repos/albengousss/Motorzaoo/actions/runs?per_page=1"
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    logs_url = data['workflow_runs'][0]['logs_url']

print(f"Logs URL: {logs_url}")
# Need a token for logs download usually, but public repo might allow it? Let's check.
try:
    req2 = urllib.request.Request(logs_url)
    with urllib.request.urlopen(req2) as response2:
        with zipfile.ZipFile(io.BytesIO(response2.read())) as z:
            for filename in z.namelist():
                if "Sync Capacitor" in filename:
                    print(f"--- {filename} ---")
                    print(z.read(filename).decode())
except Exception as e:
    print(f"Error: {e}")

