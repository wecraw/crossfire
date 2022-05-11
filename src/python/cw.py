#!/usr/bin/python
import puz
import dateparser
import json
import os

monday = open("clues.txt", "w")
all_files = [
    './clues/monday.txt',
    './clues/tuesday.txt',
    './clues/wednesday.txt',
    './clues/thursday.txt',
    './clues/friday.txt',
    './clues/saturday.txt',
    './clues/sunday.txt'
]
files = [open(i, 'w') for i in all_files]
count = 0
directory = './puzzles'


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
    if len(answer) > 8:
        return True
    if clue.isupper():
        return True


for i, file in enumerate(files):
    if i == 0:
        file.write("export const mondayClues = [\n")
    if i == 1:
        file.write("export const tuesdayClues = [\n")        
    if i == 2:
        file.write("export const wednesdayClues = [\n")
    if i == 3:
        file.write("export const thursdayClues = [\n")
    if i == 4:
        file.write("export const fridayClues = [\n")
    if i == 5:
        file.write("export const saturdayClues = [\n")
    if i == 6:
        file.write("export const sundayClues = [\n")


for filename in os.listdir(directory):
    puzFile = os.path.join(directory, filename)
    fileNameNoDir = os.path.splitext(filename)[0]
    fileNameFormatted = fileNameNoDir[:3] + "-" + fileNameNoDir[3:]
    fileNameFormatted = fileNameFormatted[:6] + "-" + fileNameFormatted[6:]
    
    if os.path.isfile(puzFile):
        fileNameNoDir = os.path.splitext(filename)[0]
        fileNameFormatted = fileNameNoDir[:3] + "-" + fileNameNoDir[3:]
        fileNameFormatted = fileNameFormatted[:6] + "-" + fileNameFormatted[6:]
        date = dateparser.parse(fileNameFormatted)
        day_number = date.weekday()
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
                    files[day_number].write("[\"" + str(clue['num']) + '\",' + formattedClue + ',' + json.dumps(answer) + "],\n")
            for clue in numbering.down:
                answer = ''.join(
                    p.solution[clue['cell'] + i * numbering.width]
                    for i in range(clue['len']))
                formattedClue = json.dumps(clue['clue'])
                if not contains_forbidden(formattedClue, answer):
                    files[day_number].write("[\"" + str(clue['num']) + '\",' + formattedClue + ',' + json.dumps(answer) + "],\n")


for file in files:
    file.write("]")