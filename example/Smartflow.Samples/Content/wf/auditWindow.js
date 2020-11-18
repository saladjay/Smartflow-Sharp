﻿(function () {

    function AuditWindow(option) {
        var $this = this;
        var instanceID = util.doQuery("instanceID");
        var code = util.doQuery('code');
        this.back = "NID_BACK_ID_80_11";
        this.veto = "NID_REJECT_ID_80_11";
        this.user = util.getUser();
        this.nodeSetting = {
            group: [],
            organization: [],
            actor: [],
            carbon: []
        };
        this.ActorIndex = 0;
        this.settings = $.extend({
            instanceID: instanceID,
            code: code
        }, option);
        $.each(['_bindSelect', '_initEvent'], function (index, propertyName) {
            $this[propertyName]();
        });
    }

    AuditWindow.prototype.close = function () {
        parent.layer.closeAll();
        if (window.top.util.refresh) {
            window.top.util.refresh();
        }
    };

    AuditWindow.prototype.actorSelect = function (id, callback) {
        var $this = this,
            setting = $this.settings;
        util.ajaxWFService({
            url: setting.actorUrl,
            type: 'post',
            data: JSON.stringify({
                ID: setting.instanceID,
                Destination: id
            }),
            success: function (data) {
                $this.nodeSetting.actor = util.convertToActor(data.Actor);
                $this.nodeSetting.group = util.convertToActor(data.Group);
                $this.nodeSetting.organization = util.convertToActor(data.Organization);
                $this.nodeSetting.carbon = util.convertToActor(data.Carbon);
                callback && callback();
            }
        });
    }

    AuditWindow.prototype.show = function (id, callback) {
        var $this = this,
            setting = $this.settings;
        if (id == $this.back) {
            $("#next_audit_user").hide();
        } else {
            util.ajaxWFService({
                url: setting.showUrl,
                type: 'post',
                data: JSON.stringify({
                    ID: setting.instanceID,
                    Destination: id
                }),
                success: function (nodeType) {
                    var type = nodeType.toLowerCase();
                    if ($.inArray(type, ['decision', 'start', 'fork', 'merge', 'end']) > -1) {
                        $("#next_audit_user").hide();
                    }
                    else {
                        $this.checkCooperation(function () {
                            $this.actorSelect(id);
                            $("#next_audit_user").show();
                        });
                    }
                }
            });
        }
    }

    AuditWindow.prototype.checkCooperation = function (callback) {
        var $this = this,
            setting = $this.settings;

        util.ajaxWFService({
            url: setting.cooperation,
            type: 'post',
            data: JSON.stringify({
                ID: setting.instanceID,
                ActorID: $this.user.ID
            }),
            success: function (cooperation) {
                if (parseInt(cooperation, 10) == 1) {
                    $("#next_audit_user").hide();
                } else {
                    callback && callback();
                }
            }
        });
    }

    AuditWindow.prototype._bindSelect = function () {
        var $this = this, setting = $this.settings;
        util.ajaxWFService({
            url: setting.select,
            type: 'post',
            data: JSON.stringify({
                ID: setting.instanceID,
                ActorID: $this.user.ID
            }),
            success: function (serverData) {
                var htmlArray = [];
                $.each(serverData, function () {
                    htmlArray.push("<option value='" + this.NID + "'>" + this.Name + "</option>");
                });
                $(setting.selectOption).html(htmlArray.join(''));
                $this.show($(setting.selectOption).val());
                layui.form.render();
            }
        });
    };

    AuditWindow.prototype._initEvent = function () {
        var $this = this;
        //审核窗口中确定按钮
        $($this.settings.buttonId).click(function () {
            var data = layui.form.val('next_form'),
                message = data.message;
            var n = $this.nodeSetting;
            var result = $("#next_audit_user").is(":hidden");
            if (!result && n.group.length == 0 && n.actor.length == 0 && n.organization.length == 0) {
                alert('请选择审批人');
            } else if (util.isEmpty(message)) {
                $(this).attr("disabled", "disabled");
                $this.jump(message, data.to);
            } else {
                alert($this.settings.tips);
            }
        });

        var form = layui.form;
        form.on('select(ddl_operate)', function (data) {
            if (data.value === 'NID_REJECT_ID_80_11') {
                $("#next_audit_user").hide();
            } else {
                $this.show(data.value);
            }
        });

        $($this.settings.actorID).click(function () {
            $this.bindActor();
        });

        $($this.settings.carbonID).click(function () {
            parent.layer.close($this.ActorIndex);
            $this.ActorIndex = util.create({
                width: 900,
                height: 680,
                title: '抄送人',
                content: [util.carbon],
                cancel: function (index, dom) {
                    var frameContent = AuditWindow.getDOMFrame(dom);
                    frameContent.setting.set($this.nodeSetting);
                    var arr = ($this.nodeSetting.carbon || []);
                    if (arr.length > 0) {
                        var cc = [];
                        $.each(arr, function () {
                            cc.push(this.name);
                        });
                        $($this.settings.carbonID).text(cc.join('，'));
                    }
                },
                success: function (dom, index) {
                    var frameContent = AuditWindow.getDOMFrame(dom);
                    frameContent.setting.load($this.nodeSetting);
                }
            });
        });
    };

    AuditWindow.getDOMFrame = function (dom) {
        var frameId = dom.find("iframe").attr('id');
        return parent.document.getElementById(frameId).contentWindow;
    };

    AuditWindow.prototype.bindActor = function () {
        var $this = this;
        parent.layer.close($this.ActorIndex);
        $this.ActorIndex = parent.util.create({
            width: 900,
            height: 680,
            title: '参与者',
            content: [util.actor],
            cancel: function (index, dom) {
                var frameContent = AuditWindow.getDOMFrame(dom);
                frameContent.setting.set($this.nodeSetting);
            },
            success: function (dom, index) {
                var frameContent = AuditWindow.getDOMFrame(dom);
                frameContent.setting.load($this.nodeSetting);
            }
        });
    }

    AuditWindow.prototype.jump = function (message, transition) {
        var $this = this;
        var settings = this.settings,
            result = $this.user,
            param = JSON.stringify({
                instanceID: settings.instanceID,
                actorID: result.ID,
                transitionID: transition,
                message: message,
                data: {
                    CategoryCode: settings.code,
                    UUID: result.ID,
                    Name: result.Name,
                    Group: convertStrs($this.nodeSetting.group),
                    Actor: convertStrs($this.nodeSetting.actor),
                    Carbon: convertStrs($this.nodeSetting.carbon),
                    Organization: convertStrs($this.nodeSetting.organization)
                }
            });

        util.ajaxWFService({
            url: settings.jump,
            type: 'post',
            contentType: 'application/json',
            data: param,
            success: function () {
                $this.close();
            }
        });
    }

    function convertStrs(arr) {
        var data = [];
        $.each(arr, function () {
            data.push(this.id);
        });

        return data.join(',');
    }

    $.AuditWindow = function (option) {
        return new AuditWindow(option);
    };

})();

