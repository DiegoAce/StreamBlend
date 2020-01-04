#!/usr/bin/python3

import sys
import os
import re

debugStr = 'DEBUG'

def removeDebug(data, index, debugBuild):
    outer = re.compile("\((.+)\)")
    m = outer.search(data[index:])
    if debugBuild:
        return data[:index] + data[index+len(debugStr)+1:index+m.span(0)[1]-1] + data[index+m.span(0)[1]:]
    else:
        return data[:index] + data[index+m.span(0)[1]:]

def main():
    outFolder = sys.argv[1]
    buildType = sys.argv[2]
    for fileName in os.listdir(outFolder):
        if fileName.endswith('.js'):
            file = open(outFolder + '/' + fileName, 'r+')
            data = file.read()
            file.close()
            startIndex = 0
            while 1:
                index = data.find(debugStr, startIndex, len(data))
                if index == -1:
                    break
                data = removeDebug(data, index, buildType=='debug')
                startIndex = index
            file = open(outFolder + '/' + fileName, 'w')
            file.write(data)
            file.close()

main()
