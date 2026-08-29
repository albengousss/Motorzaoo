import urllib.request
import json
import sys

url = "https://api.github.com/repos/albengousss/Motorzaoo/actions/runs?per_page=1"
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    run_id = data['workflow_runs'][0]['id']
    jobs_url = data['workflow_runs'][0]['jobs_url']

req2 = urllib.request.Request(jobs_url)
with urllib.request.urlopen(req2) as response2:
    jobs_data = json.loads(response2.read().decode())
    for step in jobs_data['jobs'][0]['steps']:
        if step['conclusion'] == 'failure':
            print(f"FAILED STEP: {step['name']}")
            print(f"Status: {step['status']}")
