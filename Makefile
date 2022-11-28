run-debug:
	flask --debug run
run-demo:
	gunicorn3 -e SCRIPT_NAME=/hackaday/farm --bind 0.0.0.0:8027 app:app
