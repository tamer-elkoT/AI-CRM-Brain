import requests
import json

response = requests.get('https://openrouter.ai/api/v1/models')
models = response.json().get('data', [])

free_models = [m['id'] for m in models if m.get('pricing', {}).get('prompt') == '0']
print("Free models:", [m for m in free_models if 'free' in m or 'gemini' in m or 'llama' in m])
