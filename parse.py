import json

f = open('words_dictionary.json')
# w = open('words_dictionary_filtered.json')

words = json.load(f)

words_f = {}
test = "test"
print(test.__len__())
for i in words:
    if i.__len__() < 9 and i.__len__() > 2:
        words_f[i] = 1

json_object = json.dumps(words_f, indent=4)

with open('words_dictionary_filtered.json', 'w') as outfile:
    outfile.write(json_object)
