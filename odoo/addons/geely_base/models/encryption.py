# -*- coding: utf-8 -*-
from Crypto.Cipher import AES
from Crypto import Random
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5 as Cipher_pkcs1_v1_5
import base64
import random
import string
from binascii import b2a_hex, a2b_hex


# AES --------------------------------------------
# 生成随机字符串 key 16位
def get_aes_key(l=16):
    return ''.join(random.sample(string.ascii_letters + string.digits, l))

def aes_depkcs7padding(data):
    newdata = ''
    for c in data:
        if ord(c) > AES.block_size:
            newdata+=c
    return newdata


# 解密
def aes_decrypt(key, text):
    cryptor = AES.new(key, AES.MODE_ECB, key)
    plain_text = cryptor.decrypt(a2b_hex(text))
    return aes_depkcs7padding(plain_text.rstrip('\0'))


# RSA --------------------------------------------------------
def get_rsa_key():
    random_generator = Random.new().read
    rsa = RSA.generate(2048, random_generator)
    public_pem = rsa.publickey().exportKey()
    private_pem = rsa.exportKey()
    return public_pem, private_pem


# 加密
def rsa_encrypt(key, message):
    """
    :param key: 公钥
    :param message:
    :return:
    """
    rsakey = RSA.importKey(key)
    cipher = Cipher_pkcs1_v1_5.new(rsakey)
    cipher_text = base64.b64encode(cipher.encrypt(message.encode(encoding="utf-8")))
    return cipher_text


# 解密
def rsa_decrypt(key, cipher_text):
    """
    :param key: 私钥
    :param cipher_text:
    :return:
    """
    if not cipher_text:
        return cipher_text
    rsakey = RSA.importKey(key)
    cipher = Cipher_pkcs1_v1_5.new(rsakey)
    text = cipher.decrypt(base64.b64decode(cipher_text), '')

    return text
