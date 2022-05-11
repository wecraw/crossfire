#!/usr/bin/python
import puz
import dateparser
import json
import os
from collections import OrderedDict

answers = open("answers.txt", "w")
answers_array = []

count = 0
directory = './puzzles'
weekdays = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
]


def contains_forbidden(clue, answer):
    if "*" in clue:
        return True 
    if "-Down" in clue:
        return True
    if "-Across" in clue:
        return True
    if "puzzle" in clue:
        return True
    if "starred clue" in clue:
        return True
    if "asterisked clue" in clue:
        return True
    if "clue" in clue and "ACR" in answer:
        return True
    if "clue" in clue and "DOWN" in answer:
        return True
    if "clue" in clue.lower() and "down" in clue.lower():
        return True
    if "clue" in clue.lower() and "across" in clue.lower():
        return True
    if "circled" in clue:
        return True
    if len(answer) > 15:
        return True


for filename in os.listdir(directory):
    puzFile = os.path.join(directory, filename)
    fileNameNoDir = os.path.splitext(filename)[0]
    fileNameFormatted = fileNameNoDir[:3] + "-" + fileNameNoDir[3:]
    fileNameFormatted = fileNameFormatted[:6] + "-" + fileNameFormatted[6:]
    
    if os.path.isfile(puzFile):
        # fileNameNoDir = os.path.splitext(filename)[0]
        # fileNameFormatted = fileNameNoDir[:3] + "-" + fileNameNoDir[3:]
        # fileNameFormatted = fileNameFormatted[:6] + "-" + fileNameFormatted[6:]
        # date = dateparser.parse(fileNameFormatted)
        # day_number = date.weekday()
        count = count + 1
        print("Parsed " + str(count) + " puzzles", end='\r')
        p = puz.read(puzFile)
        numbering = p.clue_numbering()
        
        if not puz.Puzzle.has_rebus(p): #filter out puzzles that contain rebus answers
            for clue in numbering.across:
                answer = ''.join(
                    p.solution[clue['cell'] + i]
                    for i in range(clue['len']))
                formattedClue = json.dumps(clue['clue'])
                if not contains_forbidden(formattedClue, answer):
                    answers_array.append(json.dumps(answer))
            for clue in numbering.down:
                answer = ''.join(
                    p.solution[clue['cell'] + i * numbering.width]
                    for i in range(clue['len']))
                formattedClue = json.dumps(clue['clue'])
                if not contains_forbidden(formattedClue, answer):
                    answers_array.append(json.dumps(answer))


reduced_answers = list(OrderedDict.fromkeys(answers_array))

for answer in reduced_answers:
    answers.write(answer + ",\n")