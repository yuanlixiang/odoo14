# -*- coding:utf-8 -*-

from PIL import Image, ImageFont, ImageDraw, ImageFilter
import random
from io import StringIO
import os, io, base64


# 返回随机字母
def charRandom():
    return chr((random.randint(65, 90)))


# 返回随机数字
def numRandom():
    return random.randint(0, 9)


# 随机颜色
def colorRandom1():
    return (random.randint(64, 255), random.randint(64, 255), random.randint(64, 255))


# 随机长生颜色2
def colorRandom2():
    return (random.randint(0, 80), random.randint(0, 80), random.randint(0, 80))


def get_img_code(s):
    width = 60 * 4
    height = 60
    image = Image.new('RGB', (width, height), (255, 255, 255))
    # 创建font对象
    # font = ImageFont.truetype('wqy-microhei.ttc', 36)
    # font = ImageFont.truetype('arial.ttf', 36)
    try:
        font = ImageFont.truetype('DejaVuSans.ttf', 36)
    except Exception as e:
        font = ImageFont.truetype('msyh.ttc', 36)
    # 创建draw对象
    draw = ImageDraw.Draw(image)
    # 填充每一个颜色
    for x in range(width):
        for y in range(height):
            draw.point((x, y), fill=colorRandom1())
    # 输出文字charRandom()
    for t in range(len(s)):
        draw.text((60 * t + 10, 10), s[t], font=font, fill=colorRandom2())
    begin = (0, random.randint(0, height))
    end = (width, random.randint(0, height))
    linecolor = colorRandom2()
    draw.line([begin, end], fill=linecolor, width=3)
    # 模糊
    image = image.filter(ImageFilter.BLUR)

    output = io.BytesIO()
    image.save(output, format="PNG")
    data = output.getvalue()
    output.close()
    # \n replace?
    return base64.encodebytes(data)
