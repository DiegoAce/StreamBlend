#!/usr/bin/python3

import sys
import json

def main():
    srcFolder = sys.argv[1]
    outFolder = sys.argv[2]
    folderName = sys.argv[3]
    folderNames = sys.argv[4]
    file = open(srcFolder + '/manifest.json')
    data = json.load(file)
    file.close()
    for f in folderNames.split():
        keyName = f + "OnlyData"
        if f == folderName:
            for key,value in data[keyName].items():
                data[key] = value
        data.pop(keyName)
    outFile = open(outFolder + '/' + folderName + '/manifest.json', 'w')
    json.dump(data, outFile, indent=4)
    outFile.close()

main()
