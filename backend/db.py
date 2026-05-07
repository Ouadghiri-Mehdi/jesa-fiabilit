import os
from supabase import create_client, Client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

def get_db() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
