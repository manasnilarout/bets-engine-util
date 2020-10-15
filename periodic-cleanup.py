#!/usr/bin/python3

import os
import pymysql
import datetime
from dotenv import load_dotenv
from pathlib import Path

# Load env to the project first
env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)

# Getting ENV variables
DB_HOST = os.getenv('MYSQL_HOST')
DB_USER = os.getenv('MYSQL_USER')
DB_PASS = os.getenv('MYSQL_PASSWORD')
DB_NAME = os.getenv('MYSQL_DB')

# Connect to DB
db = pymysql.connect(DB_HOST, DB_USER, DB_PASS, DB_NAME)

try:
    cursor = db.cursor()
    time_now = datetime.datetime.today()
    persistance_days = 2
    month_ago = time_now - datetime.timedelta(days=persistance_days)

    disable_safe_update = 'SET SQL_SAFE_UPDATES = 0;'
    query = f'DELETE FROM scoreext WHERE createdtime < \'{month_ago.isoformat()}\';'

    # Execute SQL query using execute() method.
    print(f'Disabling safe update.\n- {disable_safe_update}')
    cursor.execute(disable_safe_update)

    print(f'Deleting records older than {persistance_days} days.\n- {query}')
    resp = cursor.execute(query)

    db.commit()
    print(f'Clean up finished. Number of rows effected {resp}.')

finally:
    # Disconnect from server
    print('Closing DB Connetion')
    db.close()
