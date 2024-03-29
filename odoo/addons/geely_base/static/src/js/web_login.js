$(document).ready(function(){
    var $loginForm = $(".oe_login_form");
    $loginForm.css('width', '350px');
    $loginForm.find(".oe_login_buttons button").on("click", function (ev) {
        ev.preventDefault();
        var $username = $loginForm.find("input[name='login']");
        var $userpass = $loginForm.find("input[name='password']");
        var $imgcode = $loginForm.find("input[name='img_code']");
        var $alert = $loginForm.find('.alert');
        var text = '用户名/密码不能为空';
        if($username.val() == '' || $userpass.val() == ''){
            messageAlert($alert, text);
            return ;
        }
        if($imgcode && $imgcode.val() == ''){
            text = '验证码不能为空';
            messageAlert($alert, text);
            return ;
        }
        $alert.remove();
        var key = $loginForm.find("#rsa_public_key").attr('data-value');
        var encrypt = new JSEncrypt();
        encrypt.setPublicKey(key);
        var encrypt_userpass = encrypt.encrypt($userpass.val());
        $userpass.val(encrypt_userpass);
        $loginForm.submit();
    });
    $loginForm.find(".login-img-code-refresh").on("click", function () {
        $.post('/geely/refresh/code', {csrf_token:odoo.csrf_token}, function(data) {
            $loginForm.find('img.login-img-code').attr({src: data});
        });
    });

    function messageAlert($el, text) {
        if($el.length > 0){
            if($el.hasClass('.alert-danger')){
                $el.text(text);
            }else{
                $el.attr('role','alert')
                    .text(text)
                    .removeClass('alert-sucess')
                    .addClass('alert-danger');
            }
        }else{
            $loginForm.find('.oe_login_buttons')
                .before('<p class="alert alert-danger" role="alert">'
                    + text +
                '</p>');
        }
    }
});
