@echo off
python -m venv venv
call .\venv\Scripts\activate.bat
python -m pip install --upgrade pip setuptools wheel
python -m pip install --upgrade --upgrade-strategy eager -r requirements.txt
python -m pip install --upgrade "peft>=0.17.1,<1.0"
python main.py
pause
