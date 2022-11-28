#!/bin/python3
import flask, flask_login
from flask import url_for, request, render_template, redirect
from flask_login import current_user
from flask_sock import Sock
import collections, json, queue, random
from datetime import datetime
from base import app,load_info,ajax,DBDict,DBList,random_id,hash_id,full_url_for

# -- Info for every Hack-A-Day project --
load_info({
    "project_name": "Hack-A-Walk",
    "source_url": "https://github.com/za3k/day27_walk",
    "subdir": "/hackaday/walk",
    "description": "A farming game",
    "instructions": "Walk with the keyboard. WASD or Up/Down/Left/Right.",
    "login": False,
    "fullscreen": False,
})

# -- Routes specific to this Hack-A-Day project --

@app.route("/")
def index():
    return render_template('index.html')
