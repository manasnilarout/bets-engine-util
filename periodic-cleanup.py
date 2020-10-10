#!/usr/bin/python3

# Load env to the project first
import os
import pymysql
import datetime
from dotenv import load_dotenv
from pathlib import Path  # Python 3.6+ only

env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)


DB_HOST = os.getenv('MYSQL_HOST')
DB_USER = os.getenv('MYSQL_USER')
DB_PASS = os.getenv('MYSQL_PASSWORD')
DB_NAME = os.getenv('MYSQL_DB')

db = pymysql.connect(DB_HOST, DB_USER, DB_PASS, DB_NAME)

try:
    cursor = db.cursor()
    time_now = datetime.datetime.today()
    month_ago = time_now - datetime.timedelta(days=30)

    disable_safe_update = 'SET SQL_SAFE_UPDATES = 0;'
    query = f'DELETE FROM scoreext WHERE createdtime < \'{month_ago.isoformat()}\';'

    # execute SQL query using execute() method.
    print(f'Disabling safe update.\n- {disable_safe_update}')
    cursor.execute(disable_safe_update)
    print(f'Deleting records older than 30 days.\n- {query}')
    cursor.execute(query)
    print('Clean up finished.')

finally:
    # disconnect from server
    print('Closing DB Connetion')
    db.close()