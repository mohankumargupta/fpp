
STATUS_IDLE = "0";
STATUS_PLAYING = "1";
STATUS_STOPPING_GRACEFULLY = "2";
STATUS_STOPPING_GRACEFULLY_AFTER_LOOP = "3";
STATUS_PAUSED = "5";


// Globals
gblCurrentPlaylistIndex = 0;
gblCurrentPlaylistEntryType = '';
gblCurrentPlaylistEntrySeq = '';
gblCurrentPlaylistEntrySong = '';
gblCurrentLoadedPlaylist  = '';
gblCurrentLoadedPlaylistCount = 0;
gblNavbarMenuVisible = 0;
gblStatusRefreshSeconds = 5;

var max_retries = 60;
var retry_poll_interval_arr = [];

var minimalUI = 0;
var hasTouch = false;
var statusTimeout = null;
var lastStatus = '';
var lastStatusJSON = null;
var statusChangeFuncs = [];

if(('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0)){
    hasTouch=true;
}

/* On Page Ready Functions */

$(function() {
    OnSystemStatusChange(RefreshHeaderBar);
    OnSystemStatusChange(IsFPPDrunning);
    bindVisibilityListener();
    $(document).on('click', '.navbar-toggler', ToggleMenu);
    $(document).on('keydown', handleKeypress);

    if(hasTouch==true){
        $('body').addClass('has-touch');
        var swipeHandler = new SwipeHandler($('.header').get(0));
        swipeHandler.onLeft(function() {
            $('.header').toggleClass('swiped');
        });
        swipeHandler.onRight(function() {
            $('.header').toggleClass('swiped');
        });
        swipeHandler.run();
    }else{
        $('body').addClass('no-touch');
    }
    
    $.jGrowl.defaults.closerTemplate = '<div>Close Notifications</div>';
    SetupToolTips();
    LoadSystemStatus();
    CheckBrowser();
	CheckRestartRebootFlags();
});

(function ( $ ) {

    /*  A custom jQuery plugin that uses jQueryUI.Dialog API
        to create equivalent bootstrap modals. */
    
    $.fn.fppDialog = function( options ) {
        if(options=='close'){
          this.each(function() {
              $(this).modal('hide');
          });
          return this;
        }
        if(options=='open'){
          this.each(function() {
              $(this).modal('show');
          });
          return this;
        }
        if(options=='enableClose'){
            this.each(function() {
                $(this).removeClass('no-close');
            });
            return this;
        }
        if(options=='moveToTop'){
          return this;
        }
        if(options=='option'){
          return this
        }
        var settings = $.extend({
            title:'',
            dialogClass:'',
            width:null,
            content:null,
            footer:null,
            closeText:'<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>'
        }, options );

        this.each(function() {
            var $buttons= $(this).find('.modal-footer').html('');
            var $title='';
            var self = this;
            var modalOptions ={}
            if(settings.dialogClass.split(' ').includes('no-close')){
                $.extend(modalOptions,{backdrop:'static'})
            }
            $(this).addClass(settings.dialogClass);
            if(!$(this).hasClass('has-title')){
                $(this).addClass('has-title');
                var title = settings.title;
                if(title!==''){
                    title='<h3 class="modal-title">'+settings.title+'</h3>'
                }
                $title=$('<div class="modal-header">'+title+'</div>');
            }else{
                $(this).find('.modal-title').html(settings.title);
            }

            if(settings.buttons){
              if(!$(this).hasClass('has-buttons')){
                $(this).addClass('has-buttons');
                $buttons=$('<div class="modal-footer"/>');
              }
              $.each(settings.buttons,function(buttonKey,buttonProps){
                var buttonText=buttonKey;
                var handleClick = buttonProps;
                var buttonClass = 'buttons';
                if(typeof buttonProps ==='object'){
                  if(buttonProps.click){
                    handleClick=buttonProps.click;
                  }
                  if(buttonProps.text){
                    buttonText=buttonProps.text;
                  }
                  if(buttonProps.class){
                      buttonClass+=' '+buttonProps.class
                  }
                }
                $newButton=$('<button class="'+buttonClass+'">'+buttonText+'</button>');
                $newButton.on('click',function(){
                  handleClick.call(self);
                })
                $buttons.append($newButton);
              });
            }else if(settings.footer){
                if(!$(this).hasClass('has-footer')){
                    $(this).addClass('has-footer');
                    $buttons=$('<div class="modal-footer"/>');
                }
                $buttons.append(settings.footer);
            }

            if(!$(this).hasClass('modal')){
                var $dialogBody = $('<div class="modal-body"/>');
                var modalDialogSizeClass = '';
                if(settings.width){
                    if(settings.width<400){
                        modalDialogSizeClass='modal-sm';
                    }
                    if(settings.width>500){
                        modalDialogSizeClass='modal-lg';
                    }
                    if(settings.width>799){
                        modalDialogSizeClass='modal-xl';
                    }
                    if(settings.width>1099){
                        modalDialogSizeClass='modal-xxl';
                    }
                }

                var modalDialogClass = "modal-dialog "+modalDialogSizeClass;
                var $dialogInner = $('<div class="'+modalDialogClass+'"/>');
                if(settings.height){
                    if(settings.height=='100%'){
                        $dialogBody.css({
                            height:'calc(100vh - 100px)'
                        });
                        $dialogInner.css({
                            'margin-top':'10px'
                        });
                    }else{
                        $dialogBody.height(settings.height);
                    }
                    
                }
          
                $(this).wrapInner( $dialogBody );
                $(this).addClass('modal fade');
                $(this).prepend($title);
                $(this).append($buttons);
                if(settings.closeText){
                    if(!$(this).hasClass('has-closeText')){
                        $(this).addClass('has-closeText');
                        $title.append(settings.closeText);
                    }
                }
            
                
                var $dialogContent = $('<div class="modal-content"/>');
                $(this).wrapInner($dialogInner.wrapInner($dialogContent));
                if(settings.content){
                    $dialogBody.html(settings.content);
                }
            }

            if(settings.open && typeof settings.open==='function'){
                $(this).on('show.bs.modal', function(){
                    settings.open.call(self);
                })
            }

            if(settings.close && typeof settings.close==='function'){
                $(this).on('hide.bs.modal', function(){
                    settings.close.call(self);
                })
            }
            $(this).modal(modalOptions).addClass('fppDialog');
        });
        return this;
    };
}( jQuery ));

function handleKeypress(e) {
	if(e.keyCode == 112) {
		e.preventDefault();
		DisplayHelp();
	}
};
class SwipeHandler {
    constructor(element) {
        this.xDown = null;
        this.yDown = null;
        this.element = typeof(element) === 'string' ? document.querySelector(element) : element;

        this.element.addEventListener('touchstart', function(evt) {
            this.xDown = evt.touches[0].clientX;
            this.yDown = evt.touches[0].clientY;
        }.bind(this), false);
    }
    onLeft(callback) {
        this.onLeft = callback;
        return this;
    }

    onRight(callback) {
        this.onRight = callback;
        return this;
    }

    onUp(callback) {
        this.onUp = callback;
        return this;
    }

    onDown(callback) {
        this.onDown = callback;
        return this;
    }
    handleTouchMove(evt) {
        if ( ! this.xDown || ! this.yDown ) {
            return;
        }
        var xUp = evt.touches[0].clientX;
        var yUp = evt.touches[0].clientY;
        this.xDiff = this.xDown - xUp;
        this.yDiff = this.yDown - yUp;

        if ( Math.abs( this.xDiff ) > Math.abs( this.yDiff ) ) { // Most significant.
            if ( this.xDiff > 0 ) {
                this.onLeft();
            } else {
                this.onRight();
            }
        } else {
            if ( this.yDiff > 0 ) {
                this.onUp();
            } else {
                this.onDown();
            }
        }
        // Reset values.
        this.xDown = null;
        this.yDown = null;
    }

    run() {
        this.element.addEventListener('touchmove', function(evt) {
            this.handleTouchMove(evt).bind(this);
        }.bind(this), false);
    }
}
function CheckBrowser() {
    var ua = window.navigator.userAgent;
    var msie = ua.indexOf('MSIE '); // IE<11
    var trident = ua.indexOf('Trident/'); // IE11
    if (msie > 0 || trident > 0) {
       // IE 10 or older => return version number
        $('#unsupportedBrowser').show();
    } else {
        $('#unsupportedBrowser').hide();
    }
    if(navigator.userAgent.indexOf('Mac') > 0) {
        $('body').addClass('mac-os');
    }
}


/* jQuery helper method to allow for PUT (similar to standard GET/POST)*/
$.put = function(url, data, callback, type){
    if ( $.isFunction(data) ){
        type = type || callback,
        callback = data,
        data = {}
    }else if(data != undefined && typeof data != "object"){
        data = JSON.stringify(data);
    }

    return $.ajax({
        url: url,
        type: 'PUT',
        success: callback,
        data: data,
        contentType: type
    });
}

/* jQuery helper method to allow for DELETE (similar to standard GET/POST)*/
$.delete = function(url, data, callback, type){
    if ( $.isFunction(data) ){
        type = type || callback,
        callback = data,
        data = {}
    }else if(data != undefined && typeof data != "object"){
        data = JSON.stringify(data);
    }

    return $.ajax({
        url: url,
        type: 'DELETE',
        success: callback,
        data: data,
        contentType: type
    });
}

function PadLeft(string,pad,length) {
    return (new Array(length+1).join(pad)+string).slice(-length);
}

function SecondsToHuman(seconds) {
    var m = parseInt(seconds / 60);
    var s = parseInt(seconds % 60);
    var h = parseInt(seconds / 3600);
    if (h > 0) {
        m = m % 60;
        return PadLeft(h, '0', 2) + ':' + PadLeft(m, '0', 2) + ':' + PadLeft(s, '0', 2);
    }
    return PadLeft(m, '0', 2) + ':' + PadLeft(s, '0', 2);
}

function versionToNumber(version)
{
    // convert a version string like 2.7.1-2-dirty to "20701"
    if (version.charAt(0) == 'v') {
        version = version.substr(1);
    }
    if (version.indexOf("-") != -1) {
        version = version.substr(0, version.indexOf("-"));
    }
    var parts = version.split('.');

    while (parts.length < 3) {
        parts.push("0");
    }
    var number = 0;
    for (var x = 0; x < 3; x++) {
        var val = parseInt(parts[x]);
        if (val >= 9990) {
            return number * 10000 + 9999;
        } else if (val > 99) {
            val = 99;
        }
        number = number * 100 + val;
    }
    return number;
}

function TogglePasswordHideShow(setting) {
    if (setting.indexOf('Verify') > 0)
        setting = setting.replace(/Verify$/, '');

    if ($('#' + setting).attr('type') == 'text') {
        $('#' + setting).attr('type', 'password');
        $('#' + setting + 'Verify').attr('type', 'password');
        $('#' + setting + 'HideShow').removeClass('fa-eye-slash');
        $('#' + setting + 'VerifyHideShow').removeClass('fa-eye-slash');
        $('#' + setting + 'HideShow').addClass('fa-eye');
        $('#' + setting + 'VerifyHideShow').addClass('fa-eye');
    } else {
        $('#' + setting).attr('type', 'text');
        $('#' + setting + 'Verify').attr('type', 'text');
        $('#' + setting + 'HideShow').removeClass('fa-eye');
        $('#' + setting + 'VerifyHideShow').removeClass('fa-eye');
        $('#' + setting + 'HideShow').addClass('fa-eye-slash');
        $('#' + setting + 'VerifyHideShow').addClass('fa-eye-slash');
    }
}

function RegexCheckData(regexStr, value, desc, hideValue = false) {
    var regex = new RegExp(regexStr);

    if (regex.test(value)) {
        return true;
    }

    if (hideValue)
        DialogError('Data Format Error', "ERROR: The new value does not match proper format: " + desc);
    else
        DialogError('Data Format Error', "ERROR: '" + value + "' does not match proper format: " + desc);
    return false;
}

// Compare two version numbers
function CompareFPPVersions(a, b) {
	// Turn any non-string version numbers into a string
	a = "" + a;
	b = "" + b;
    a = versionToNumber(a);
    b = versionToNumber(b);

	if (a > b) {
		return 1;
	} else if (a < b) {
		return -1;
	}

	return 0;
}

function Convert24HToUIFormat(tm) {
    var newTime = tm;

    if (tm.indexOf(':') == -1) // Sunrise/Sunset/Dusk/Dawn
        return tm;

    var fmt = '%I:%M %p'; // default format in settings.json

    var showingSeconds = false;
    if ((settings.hasOwnProperty('ScheduleSeconds')) && (settings['ScheduleSeconds'] == 1))
        showingSeconds = true;

    if (settings.hasOwnProperty('TimeFormat'))
        fmt = settings['TimeFormat'];

    if (fmt == '%H:%M') { // if set to use 24H time then just exit
        if (showingSeconds)
            return tm;
        else
            return tm.substr(0, 5);
    }

    var parts = tm.split(':');
    var h = parseInt(parts[0]);
    var m = parseInt(parts[1]);
    var s = parseInt(parts[2]);

    var ampm = 'AM';
    var h12 = h;
    if (h >= 12) {
        ampm = 'PM';
        h12 -= 12;
    }

    if (fmt == '%I:%M %p') {
        newTime = PadLeft(h12, '0', 2) + ':' + PadLeft(m, '0', 2);

        if (showingSeconds)
            newTime += ':' + PadLeft(s, '0', 2);

        newTime += ' ' + ampm;
    }

    return newTime;
}

function Convert24HFromUIFormat(tm) {
    var newTime = tm;

    if (tm.indexOf(':') == -1) // Sunrise/Sunset/Dusk/Dawn
        return tm;

    var fmt = '%I:%M %p'; // default format in settings.json

    var showingSeconds = false;
    if ((settings.hasOwnProperty('ScheduleSeconds')) && (settings['ScheduleSeconds'] == 1))
        showingSeconds = true;

    if (settings.hasOwnProperty('TimeFormat'))
        fmt = settings['TimeFormat'];

    if (fmt == '%H:%M') { // if set to use 24H time then just exit
        if (showingSeconds)
            return tm;
        else
            return tm + ':00';
    }

    var h = 0;
    var m = 0;
    var s = 0;

    if (fmt == '%I:%M %p') {
        var tmp = tm.split(/ /);
        var parts = tmp[0].split(':');
        h = parseInt(parts[0]);
        m = parseInt(parts[1]);

        if (showingSeconds)
            s = parseInt(parts[2]);

        if ((tmp[1] == 'PM') || (tmp[1] == 'pm'))
            h += 12;
    }

    newTime = PadLeft(h, '0', 2) + ':' + PadLeft(m, '0', 2) + ':' + PadLeft(s, '0', 2);

    return newTime;
}

function InitializeTimeInputs(format = 'H:i:s') {
    $('.time').timepicker({
        'timeFormat': format,
        'typeaheadHighlight': false
    });
}

function InitializeDateInputs(format = 'yy-mm-dd') {
    $('.date').datepicker({
        'changeMonth': true,
        'changeYear': true,
        'dateFormat': format,
        'minDate': new Date(MINYEAR - 1, 1 - 1, 1),
        'maxDate': new Date(MAXYEAR, 12 - 1, 31),
        'showButtonPanel': true,
        'selectOtherMonths': true,
        'showOtherMonths': true,
        'yearRange': "" + MINYEAR +":" + MAXYEAR,
        'autoclose': true,
    });
}

function DeleteSelectedEntries(item) {
    $('#' + item).find('.selectedEntry').remove();
}

function AddTableRowFromTemplate(table) {
    $('#' + table).append($('#' + table).parent().parent().find('.fppTableRowTemplate').find('tr').parent().html());

    return $('#' + table + ' > tr').last();
}

function HandleTableRowMouseClick(event, row) {
    if ((event.target.nodeName == 'INPUT') ||
        (event.target.nodeName == 'TEXTAREA') ||
        (event.target.nodeName == 'SELECT'))
        return;

    event.preventDefault(); // prevent mouse move from highlighting text

    if (row.hasClass('selectedEntry')) {
        row.removeClass('selectedEntry');
    } else {
        if (event.shiftKey) {
            var na = row.nextAll().length;
            var nl = row.nextUntil('.selectedEntry').length;
            var pa = row.prevAll().length;
            var pl = row.prevUntil('.selectedEntry').length;

            if (pa == pl)
                pl = -1;

            if (na == nl)
                nl = -1;

            if ((pl >= 0) && (nl >= 0)) {
                if (nl > pl) {
                    row.prevUntil('.selectedEntry').addClass('selectedEntry');
                } else {
                    row.nextUntil('.selectedEntry').addClass('selectedEntry');
                }
            } else if (pl >= 0) {
                row.prevUntil('.selectedEntry').addClass('selectedEntry');
            } else if (nl >= 0) {
                row.nextUntil('.selectedEntry').addClass('selectedEntry');
            }
        } else {
            if (!event.ctrlKey) {
                row.parent().find('tr').removeClass('selectedEntry');
            }
        }

        row.addClass('selectedEntry');
    }
}

var StreamScriptStart = "<script class='streamScript'>";
var StreamScriptEnd   = "</script>";
var StreamScript = '';
function ProcessStreamedScript(str, allowEmpty = false) {
    if (str.length == 0)
        return;

    if ((StreamScript != '') || (allowEmpty == true)) {
        var i = str.indexOf(StreamScriptEnd);
        if (i >= 0) {
            // this packet contains the end of the script
            StreamScript += str.substr(0, i);
            eval(StreamScript);
            StreamScript = '';

            var remaining = str.length - i - StreamScriptEnd.length;
            if (remaining > 0)
                ProcessStreamedScript(str.substr(i + 1, remaining));
        } else {
            // script is continued on in next data packet
            StreamScript += str;
        }
    } else {
        var i = str.indexOf(StreamScriptStart);
        if (i >= 0) {
            var remaining = str.length - i - StreamScriptStart.length;
            if (remaining > 0)
                ProcessStreamedScript(str.substr(i + StreamScriptStart.length, remaining), true);
        }
    }
}

function StreamURL(url, id, doneCallback = '', errorCallback = '', reqType = 'GET', postData = null, postContentType = null, postProcessData = true, raw = false) {
    var last_response_len = false;
    var outputArea = document.getElementById(id);
    var reAddLF = false;

    $.ajax(url, {
        type: reqType,
        contentType: postContentType,
        data: postData,
        processData: postProcessData,
        xhrFields: {
            onprogress: function(e)
            {
                var this_response, response = e.currentTarget.response;
                if(last_response_len === false)
                {
                    this_response = response;
                    last_response_len = response.length;
                }
                else
                {
                    this_response = response.substring(last_response_len);
                    last_response_len = response.length;
                }

                if (reAddLF) {
                    this_response = "\n" + this_response;
                    reAddLF = false;
                }

                if (this_response.endsWith("\n")) {
                    this_response = this_response.replace(/\n$/, "");
                    reAddLF = true;
                }

                var orig_response = this_response;

                if ((outputArea.nodeName == "DIV") ||
                    (outputArea.nodeName == "TD") ||
                    (outputArea.nodeName == "PRE") ||
                    (outputArea.nodeName == "SPAN")) {
                    if ((outputArea.nodename != "PRE") && (raw == false)) {
                        this_response = this_response.replace(/(?:\r\n|\r|\n)/g, '<br>');
                    }

                    outputArea.innerHTML += this_response;
                } else {
                    outputArea.value += this_response;
                }

                ProcessStreamedScript(orig_response);

                outputArea.scrollTop = outputArea.scrollHeight;
                outputArea.parentElement.scrollTop = outputArea.parentElement.scrollHeight;
            }
        }
    }).done(function(data) {
        // Because xhrFields.onprogress is not guarenteed to fire on the last chunk
        // any scripts at the end may be missed.  This will execute those, but has
        // the side effecting of running all other streamScripts again.
        $("script.streamScript").each(function() {
            eval($(this).html());
        });
        if (doneCallback != '') {
            window[doneCallback](id);
        }
    }).fail(function(data) {
        if (errorCallback != '') {
            window[errorCallback](id);
        }
    });
}

function PostPutHelper(url, async, data, silent, type) {
    var result = {};

    $.ajax({
        url: url,
        type: type,
        contentType: 'application/json',
        data: data,
        async: async,
        dataType: 'json',
        success: function(data) {
            result = data;
        },
        error: function() {
            if (!silent) {
                $.jGrowl('Error with ' + type + ' to ' + url,{themeState:'danger'});
            }
        }
    });

    return result;
}

function Post(url, async, data, silent = false) {
    return PostPutHelper(url, async, data, silent, 'POST');
}

function Put(url, async, data, silent = false) {
    return PostPutHelper(url, async, data, silent, 'PUT');
}

function Get(url, async, silent = false) {
    var result = {};

    $.ajax({
        url: url,
        type: 'GET',
        async: async,
        dataType: 'json',
        success: function(data) {
            result = data;
        },
        error: function() {
            if (!silent)
                $.jGrowl('Error: Unable to get ' + url,{themeState:'danger'});
        }
    });

    return result;
}

function GetSync(url) {
    return Get(url, false);
}

function GetAsync(url) {
    return Get(url, true);
}

function SetElementValue(elem, val) {
    if (($(elem)[0].tagName == 'INPUT') ||
        ($(elem)[0].tagName == 'SELECT')) {
        $(elem).val(val);
    } else {
        $(elem).html(val);
    }
}

function GetItemCount(url, id, key = '') {
    $.ajax({
        url: url,
        type: 'GET',
        dataType: 'json',
        success: function(data) {
            if (key != '')
                SetElementValue($('#' + id), data[key].length);
            else
                SetElementValue($('#' + id), data.length);
        },
        error: function() {
            SetElementValue($('#' + id), 'Unknown');
        }
    });
}

function SetupToolTips(delay = 100) {
    $('[title]').each(function(){
        if($(this).is('[data-tooltip-position-at]')||$(this).is('[data-tooltip-position-my]')){
            var title = $(this).attr('title');
            $(this).data('tooltip-title',title);
            
            $(this).removeAttr('title');
            var pos = { my: "left top+15", at: "left bottom", collision: "flipfit" };
            if($(this).is('[data-tooltip-position-at]')){
                pos.at=$(this).data('tooltip-position-at');
            }
            if($(this).is('[data-tooltip-position-my]')){
                pos.my=$(this).data('tooltip-position-my');
            }
            $(this).tooltip({
                items: $(this).prop('nodeName'),
                content:$(this).data('tooltip-title'),
                position:pos,
            });
        }
    });
    $(document).tooltip({
        content: function() {
            $('.ui-tooltip').hide();
            var id = $(this).attr('id');
            if ((typeof id != "undefined") &&
                (id.endsWith('_img'))) {
                id = id.replace('_img', '_tip');
                return $('#' + id).html();
            }

            var title = $(this).attr('title');
            if (typeof title != "undefined") {
                return title;
            }
            return "";
        },

        hide: { delay: delay }
    });


}
function SetHomepageStatusRowWidthForMobile(){
    if($('.statusDivTopRow').length>0){
        if($(window).width()<481){
            var statusWidth=0;
            $('.statusDivTopCol').each(function(){
                statusWidth+=$(this).outerWidth(true);
            });
            $('.statusDivTopRow').css('width',statusWidth+40)
        }else{
            $('.statusDivTopRow').css('width','')
        }

    }
}
function ShowTableWrapper(tableName) {
    if ($('#' + tableName).parent().parent().hasClass('fppTableWrapperAsTable'))
        $('#' + tableName).parent().parent().attr('style', 'display: table');
    else
        $('#' + tableName).parent().parent().show();
}

function HideTableWrapper(tableName) {
    $('#' + tableName).parent().parent().hide();
}

function ShowPlaylistDetails() {
	$('#playlistDetailsWrapper').show();
	$('#btnShowPlaylistDetails').hide();
	$('#btnHidePlaylistDetails').show();
}

function HidePlaylistDetails() {
	$('#playlistDetailsWrapper').hide();
	$('#btnShowPlaylistDetails').show();
	$('#btnHidePlaylistDetails').hide();
}

function PopulateLists(options) {
    var onPlaylistArrayLoaded=function(){}
    if(options){
        if(typeof options.onPlaylistArrayLoaded==='function'){
            onPlaylistArrayLoaded=options.onPlaylistArrayLoaded;
        }
    }
    DisableButtonClass('playlistEditButton');
	PlaylistTypeChanged();
    PopulatePlaylists(false,{
        onPlaylistArrayLoaded:onPlaylistArrayLoaded
    });
}

function PlaylistEntryTypeToString(type)
{
    switch (type ) {
        case 'both':        return 'Seq+Med';
        case 'branch':      return 'Branch';
        case 'command':     return 'Command';
        case 'dynamic':     return 'Dynamic';
        case 'event':       return 'Event';
        case 'image':       return 'Image';
        case 'media':       return 'Media';
        case 'mqtt':        return 'MQTT';
        case 'pause':       return 'Pause';
        case 'playlist':    return 'Playlist';
        case 'plugin':      return 'Plugin';
        case 'remap':       return 'Remap';
        case 'script':      return 'Script';
        case 'sequence':    return 'Sequence';
        case 'url':         return 'URL';
        case 'volume':      return 'Volume';
    }
}

function psiDetailsBegin() {
    return "<div class='psiDetailsWrapper'><div class='psiDetails'>";
}

function psiDetailsArgBegin() {
    return "<div class='psiDetailsArg'>";
}

function psiDetailsHeader(text) {
    return "<div class='psiDetailsHeader'>" + text + ":</div>";
}

function psiDetailsData(name, value, units = '', hide = false) {
    var str = '';
    var style = "";

    if (hide)
        style = " style='display: none;'";

    if (units == '') {
        return "<div class='psiDetailsData field_" + name + "'" + style + ">" + value + "</div>";
    }

    return "<div class='psiDetailsData'><span class='field_" + name + "'" + style + ">" + value + "</span> " + units + "</div>";
}

function psiDetailsArgEnd() {
    return "</div>";
}

function psiDetailsLF() {
    return "<div class='psiDetailsLF'></div>";
}

function psiDetailsEnd() {
    return "</div></div>";
}

function psiDetailsForEntrySimpleBranch(entry, editMode) {
    var result = '';

    switch (entry.branchTest) {
        case 'Time':
            result += 'Time: ' + entry.startTime + ' < X < ' + entry.endTime;
            break;
        case 'Loop':
            result += 'Loop: Every ' + entry.iterationCount + ' iterations starting at ' + entry.iterationStart;
            break;
        case 'MQTT':
            result += 'MQTT: Topic: "' + entry.mqttTopic + '", Message: "' + entry.mqttMessage;
            break;
    }

    result += psiDetailsBranchDestination(entry);

    return result;
}

function psiDetailsForEntrySimple(entry, editMode) {
    var pet = playlistEntryTypes[entry.type];
    var result = "";
    var keys = Object.keys(pet.args);
    for (var i = 0; i < keys.length; i++) {
        var a = pet.args[keys[i]];

        if (((!a.hasOwnProperty('simpleUI')) ||
             (!a.simpleUI)) &&
            (a.name != 'args')) {
            continue;
        }

        if ((editMode) &&
            (a.hasOwnProperty('statusOnly')) &&
            (a.statusOnly == true)) {
            continue;
        }

        if ((!a.optional) ||
            ((entry.hasOwnProperty(a.name)) &&
             (entry[a.name] != ''))) {
            var partialResult = '';

            if (a.type == 'args') {
                if ((entry[a.name].length == 1) &&
                    ($.isNumeric(entry[a.name][0]))) {
                    partialResult += entry[a.name][0];
                } else {
                    for (var x = 0; x < entry[a.name].length; x++) {
                        if (partialResult != '')
                            partialResult += ' ';

                        partialResult += "\"" + entry[a.name][x] + "\"";
                    }
                }
            } else if (a.type == 'array') {
                var akeys = Object.keys(entry[a.name]);
                if ((akeys.length == 1) &&
                    ($.isNumeric(entry[a.name][akeys[0]]))) {
                    partialResult += entry[a.name][akeys[0]];
                } else {
                    for (var x = 0; x < akeys.length; x++) {
                        if (partialResult != '')
                            partialResult += ' ';

                        partialResult += "\"" + entry[a.name][akeys[x]] + "\"";
                    }
                }
            } else {
                if (a.hasOwnProperty('contents')) {
                    var ckeys = Object.keys(a.contents);
                    for (var x = 0; x < ckeys.length; x++) {
                        if (a.contents[ckeys[x]] == entry[a.name]) {
                            partialResult += ckeys[x];
                        }
                    }
                } else {
                    partialResult += entry[a.name];
                }

                if (a.hasOwnProperty('unit')) {
                    partialResult += " " + a.unit;
                }
            }

            if (partialResult != '') {
                if (result != '')
                    result += " <b>|</b> ";

                result += partialResult;
            }
        }
    }

    result += "<br>";

    return result;
}

function psiDetailsForEntry(entry, editMode) {
    var pet = playlistEntryTypes[entry.type];
    var result = "";

    result += psiDetailsBegin();

    var children = [];
    var childrenToShow = [];
    var divs = 0;
    var keys = Object.keys(pet.args);
    for (var i = 0; i < keys.length; i++) {
        var a = pet.args[keys[i]];

        if ((editMode) &&
            (a.hasOwnProperty('statusOnly')) &&
            (a.statusOnly == true)) {
            continue;
        }

        if ((children.includes(a.name)) &&
            (!childrenToShow.includes(a.name))) {
            continue;
        }

        if ((!a.optional) &&
            (!entry.hasOwnProperty(a.name))) {
            if (a.hasOwnProperty("default")) {
                entry[a.name] = a.default;
            } else {
                if (a.type == 'int')
                    entry[a.name] = 0;
                else if (a.type == 'bool')
                    entry[a.name] = false;
                else
                    entry[a.name] = "";
            }
        }

        if ((!a.optional) ||
            ((entry.hasOwnProperty(a.name)) &&
             (entry[a.name] != ''))) {
            if (typeof a['children'] === 'object') {
                var val = entry[a.name];
                var ckeys = Object.keys(a.children);
                for (var c = 0; c < ckeys.length; c++) {
                    for (var x = 0; x < a.children[ckeys[c]].length; x++) {
                        if (!children.includes(a.children[ckeys[c]][x]))
                            children.push(a.children[ckeys[c]][x]);

                        if (val == ckeys[c]) {
                            childrenToShow.push(a.children[ckeys[c]][x]);
                        }
                    }
                }
            }

            if (i > 0)
                result += psiDetailsLF();

            if (a.type == 'args') {
                for (var x = 0; x < entry[a.name].length; x++) {
                    if (x > 0)
                        result += psiDetailsLF();

                    result += psiDetailsArgBegin();
                    result += psiDetailsHeader('Arg #' + (x+1));
                    result += psiDetailsData(a.name + '_' + (x+1), entry[a.name][x]);
                    result += psiDetailsArgEnd();
                }
            } else if (a.type == 'array') {
                var keys = Object.keys(entry[a.name]);
                for (var x = 0; x < keys.length; x++) {
                    if (x > 0)
                        result += psiDetailsLF();

                    result += psiDetailsArgBegin();
                    result += psiDetailsHeader('Extra Data #' + (x+1));
                    result += psiDetailsData(a.name + '_' + (x+1), entry[a.name][x]);
                    result += psiDetailsArgEnd();
                }
            } else {
                var units = '';
                if (a.hasOwnProperty('unit')) {
                    units = a.unit;
                }

                result += psiDetailsArgBegin();
                result += psiDetailsHeader(a.description);

                if (a.hasOwnProperty('contents')) {
                    result += psiDetailsData(a.name, entry[a.name], '', true);

                    var ckeys = Object.keys(a.contents);
                    for (var x = 0; x < ckeys.length; x++) {
                        if (a.contents[ckeys[x]] == entry[a.name]) {
                            result += ckeys[x] + ' ' + units;
                        }
                    }
                } else {
                    result += psiDetailsData(a.name, entry[a.name], units);
                }

                result += psiDetailsArgEnd();
            }
        }
    }

    result += psiDetailsEnd();

    return result;
}

function psiDetailsBranchDestination(entry)
{
    var result = "";

    switch (entry.trueNextBranchType) {
        case 'Index':
            result += ', True: Index: ';
            if (entry.trueNextSection != '') {
                result += entry.trueNextSection + '/';
            }
            result += entry.trueNextItem;
            break;
        case 'Offset':
            result += ', True: Offset: ' + entry.trueNextItem;
            break;
        case 'Playlist':
            result += ', True: Call Playlist: "' + entry.trueBranchPlaylist + '"';
            break;
    }

    switch (entry.falseNextBranchType) {
        case 'Index':
            result += ', False: Index: ';
            if (entry.falseNextSection != '') {
                result += entry.falseNextSection + '/';
            }
            result += entry.falseNextItem;
            break;
        case 'Offset':
            result += ', False: Offset: ' + entry.falseNextItem;
            break;
        case 'Playlist':
            result += ', False: Call Playlist: "' + entry.falseBranchPlaylist + '"';
            break;
    }

    return result;
}

function psiDetailsForEntryBranch(entry, editMode)
{
    var result = "";

    result += psiDetailsBegin();

    var branchStr = "";
    if (entry.branchTest == 'Time') {
        branchStr = entry.startTime + " < X < " + entry.endTime;
        branchStr += psiDetailsBranchDestination(entry);
    } else if (entry.branchTest == 'Loop') {
        if (entry.loopTest == 'iteration') {
            branchStr = 'Every ' + entry.iterationCount + ' iterations starting at ' + entry.iterationStart;
            branchStr += psiDetailsBranchDestination(entry);
        }
    } else if (entry.branchTest == 'MQTT') {
            branchStr = 'MQTT: Topic: "' + entry.mqttTopic + '", Message: "' + entry.mqttMessage;
            branchStr += psiDetailsBranchDestination(entry);
    } else {
        branchStr = "Invalid Config: " + JSON.stringify(entry);
    }

    result += psiDetailsHeader('Test');
    result += psiDetailsData('test', branchStr);
    result += psiDetailsEnd();

    var keys = Object.keys(entry);
    for (var i = 0; i < keys.length; i++) {
        var a = entry[keys[i]];
        if (keys[i] == 'compInfo') {
            var akeys = Object.keys(a);
            for (var x = 0; x < akeys.length; x++) {
                var aa = entry[keys[i]][akeys[x]];
                result += "<span style='display:none;' class='field_compInfo_" + akeys[x] + "'>" + aa + "</span>";
            }
        } else {
            result += "<span style='display:none;' class='field_" + keys[i] + "'>" + a + "</span>";
        }
    }

    return result;
}

function VerbosePlaylistItemDetailsToggled() {
    if ($('#verbosePlaylistItemDetails').is(':checked')) {
        $('.psiData').show();
        $('.psiDataSimple').hide();
    } else {
        $('.psiDataSimple').show();
        $('.psiData').hide();
    }
}

function GetPlaylistDurationDiv(entry) {
    var h = "";
    var s = 0;

	if ((entry.hasOwnProperty('duration')) &&
        (entry.duration > 0)) {
        h = "<b>Length:</b> " + SecondsToHuman(entry.duration);
        s = entry.duration;
    }

    return "<div class='psiDuration'><span class='humanDuration'>" + h + "</span><span class='psiDurationSeconds'>" + s + "</span></div>";
}

function GetPlaylistRowHTML(ID, entry, editMode)
{
    var HTML = "";
    var rowNum = ID + 1;

    if (editMode){
        HTML += "<tr class='playlistRow'>";
        HTML += "<td class='center' valign='middle'> <div class='rowGrip'><i class='rowGripIcon fpp-icon-grip'></i></div></td>";
    } else {    
        HTML += "<tr id='playlistRow" + rowNum + "' class='playlistRow'>";
    }

    HTML += "<td class='colPlaylistNumber";

    if (editMode)
        HTML += " colPlaylistNumberDrag";

    if (editMode)
        HTML += " playlistRowNumber'>" + rowNum + ".</td>";
    else
        HTML += " playlistRowNumber' id='colEntryNumber" + rowNum + "'>" + rowNum + ".</td>";

    var pet = playlistEntryTypes[entry.type];
    var deprecated = "";

    if ((typeof pet.deprecated === "number") &&
        (pet.deprecated == 1)) {
        deprecated = "<font color='red'><b>*</b></font>";
        $('#deprecationWarning').show();
    }

    HTML += "<td><div class='psi'><div class='psiHeader' >" + PlaylistEntryTypeToString(entry.type) + ":" + deprecated + "<span style='display: none;' class='entryType'>" + entry.type + "</span></div><div class='psiData'>";

    if (entry.type == 'dynamic') {
        HTML += psiDetailsForEntry(entry, editMode);

		if (entry.hasOwnProperty('dynamic'))
            HTML += psiDetailsForEntry(entry.dynamic, editMode);
    } else if (entry.type == 'branch') {
        HTML += psiDetailsForEntryBranch(entry, editMode);
    } else {
        HTML += psiDetailsForEntry(entry, editMode);
    }

    HTML += "</div>";

    HTML += "<div class='psiDataSimple'>";
    if (entry.type == 'dynamic') {
        HTML += psiDetailsForEntrySimple(entry, editMode);

		if (entry.hasOwnProperty('dynamic'))
            HTML += psiDetailsForEntrySimple(entry.dynamic, editMode);
    } else if (entry.type == 'branch') {
        HTML += psiDetailsForEntrySimpleBranch(entry, editMode);
    } else {
        HTML += psiDetailsForEntrySimple(entry, editMode);
    }
    HTML += "</div>";

    HTML += GetPlaylistDurationDiv(entry)
    HTML += "</div></td>"
    if (editMode) {
        HTML += '<td class="playlistRowEditActionCell">'
        HTML += '<button class="circularButton circularEditButton playlistRowEditButton">Edit</button>';
        HTML += '<button class="circularButton circularDeleteButton playlistRowDeleteButton ml-2">Delete</button>';
        HTML += '</td>'
    }
    HTML += "</tr>";

    return HTML;
}

function BranchItemToString(branchType, nextSection, nextIndex) {
    if (typeof branchType == "undefined") {
        branchType = "Index";
    }
    if (branchType == "None") {
        return "None";
    } else if (branchType == "" || branchType == "Index") {
        var r = "Index: "
        if (nextSection != "") {
            r = r + nextSection + "/";
        }
        r = r + nextIndex;
        return r;
    } else if (branchType == "Offset") {
        return "Offset: " + nextIndex;
    }
}

var oldPlaylistEntryType = '';
function PlaylistTypeChanged() {
	var type = $('#pe_type').val();

	$('.playlistOptions').hide();
    $('#pbody_' + type).show();

    var oldSequence = '';
    if ((oldPlaylistEntryType == 'sequence') ||
        (oldPlaylistEntryType == 'both')) {
        oldSequence = $('.arg_sequenceName').val();
    }

    var oldMedia = '';
    if ((oldPlaylistEntryType == 'media') ||
        (oldPlaylistEntryType == 'both')) {
        oldMedia = $('.arg_mediaName').val();
    }

    $('#playlistEntryOptions').html('');
    $('#playlistEntryCommandOptions').html('');
    PrintArgInputs('playlistEntryOptions', true, playlistEntryTypes[type].args);

    if (oldPlaylistEntryType == '') { // First load on page defaults to 'both'
        if ($('.arg_sequenceName option').length == 0) {
            if ($('.arg_mediaName option').length >= 0) {
                oldPlaylistEntryType = 'both';
                $('#pe_type').val('media');
                PlaylistTypeChanged();
                return;
            }
        } else {
            if ($('.arg_mediaName option').length == 0) {
                oldPlaylistEntryType = 'both';
                $('#pe_type').val('sequence');
                PlaylistTypeChanged();
                return;
            }
        }
    }

	if (type == 'both')
	{
		$("#autoSelectWrapper").show();
		$("#autoSelectMatches").prop('checked', true);
	}

    if (oldSequence != '') {
        $('.arg_sequenceName').val(oldSequence);
    }

    if (oldMedia != '') {
        $('.arg_mediaName').val(oldMedia);
    }

    oldPlaylistEntryType = type;
}

function PlaylistNameOK(name) {
    var tmpName = name.replace(/[^-a-zA-Z0-9_ ]/g,'');
    if (name != tmpName) {
        DialogError('Invalid Playlist Name', 'You may use only letters, numbers, spaces, hyphens, and underscores in playlist names.');
        return 0;
    }

    return 1;
}

function LoadPlaylistDetails(name) {
    $.get('api/playlist/' + name
    ).done(function(data) {
        PopulatePlaylistDetails(data, 1, name);
        RenumberPlaylistEditorEntries();
        UpdatePlaylistDurations();
        VerbosePlaylistItemDetailsToggled();
        //$("#tblPlaylistLeadInHeader").get(0).scrollIntoView();
    }).fail(function() {
        DialogError('Error loading playlist', 'Error loading playlist details!');
    });
}

function CreateNewPlaylist() {
	var name = $('#txtNewPlaylistName').val();

    if (!PlaylistNameOK(name))
        return;

    if (playListArray.includes(name)) {
		DialogError('Playlist name conflict', "Found existing playlist named '" + name + "'.  Loading existing playlist.");
        $('#playlistSelect option[value="' + name + '"]').prop('selected', true);
        LoadPlaylistDetails(name);
        return;
    }

    SetPlaylistName(name);
    $('#tblPlaylistLeadIn').html("<tr id='tblPlaylistLeadInPlaceHolder' class='unselectable'><td>&nbsp;</td></tr>");
    $('#tblPlaylistLeadIn').show();
    $('#tblPlaylistLeadInHeader').show();

    $('#tblPlaylistMainPlaylist').html("<tr id='tblPlaylistMainPlaylistPlaceHolder' class='unselectable'><td>&nbsp;</td></tr>");
    $('#tblPlaylistMainPlaylist').show();
    $('#tblPlaylistMainPlaylistHeader').show();

    $('#tblPlaylistLeadOut').html("<tr id='tblPlaylistLeadOutPlaceHolder' class='unselectable'><td>&nbsp;</td></tr>");
    $('#tblPlaylistLeadOut').show();
    $('#tblPlaylistLeadOutHeader').show();

    EnableButtonClass('playlistEditButton');
    DisableButtonClass('playlistExistingButton');
    DisableButtonClass('playlistDetailsEditButton');
}

function EditPlaylist() {
    var name = $('#playlistSelect').val();
    EnableButtonClass('playlistEditButton');
    DisableButtonClass('playlistDetailsEditButton');

    LoadPlaylistDetails(name);
    $('#playlistEditor').addClass('hasPlaylistDetailsLoaded');
}
function SetButtonState(button,state)
{
        // Enable Button
        if(state == 'enable')
        {
            $(button).addClass('buttons').addClass($(button).data('btn-enabled-class'));
            $(button).removeClass('disableButtons');
            $(button).removeAttr("disabled");
        }
        else
        {
            $(button).removeClass('buttons').removeClass($(button).data('btn-enabled-class'));
            $(button).addClass('disableButtons');
            $(button).attr("disabled", "disabled");
        }
}

function EnableButtonClass(c) {
    $('.'+c).each(function(){
        SetButtonState(this,'enable');
    })
}

function DisableButtonClass(c) {
    $('.'+c).each(function(){
        SetButtonState(this,'disable');
    })
}

function RenumberPlaylistEditorEntries() {
    var id = 1;
    var sections = ['LeadIn', 'MainPlaylist', 'LeadOut'];
    for (var s = 0; s < sections.length; s++) {
        var $sectionTable = $('#tblPlaylist' + sections[s]);
        if(!$sectionTable.is(':empty')){
            $('#tblPlaylist' + sections[s] + ' tr.playlistRow').each(function() {
                $(this).find('.playlistRowNumber').html('' + id + '.');
                id++;
            });
        }else{
            $sectionTable.append("<tr id='tblPlaylist" + sections[s] + "PlaceHolder' class='unselectable'><td>&nbsp;</td></tr>");   
        }
    }
}

function UpdatePlaylistDurations() {
    var sections = ['LeadIn', 'MainPlaylist', 'LeadOut'];
    for (var s = 0; s < sections.length; s++) {
        var duration = 0;

        $('#tblPlaylist' + sections[s] + ' tr.playlistRow').each(function() {
            if ($(this).find('.psiDurationSeconds').length)
                duration += parseFloat($(this).find('.psiDurationSeconds').html());
        });

        var items = $('#tblPlaylist' + sections[s] + ' tr.playlistRow').length;
        $('.playlistItemCount' + sections[s]).html(items);
        if (items == 1)
            items = items.toString() + " item";
        else
            items = items.toString() + " items";

        $('.playlistItemCountWithLabel' + sections[s]).html(items);

        $('.playlistDuration' + sections[s]).html(SecondsToHuman(duration));

        if (sections[s] == 'MainPlaylist')
            $('#playlistDuration').html(duration);
    }
}

function GetSequenceDuration(sequence, updateUI, row) {
    var durationInSeconds = 0;
    var file = sequence.replace(/.fseq$/, '');
    $.ajax({
        url: "api/sequence/" + encodeURIComponent(file) + '/meta',
        type: 'GET',
        async: updateUI,
        dataType: 'json',
        success: function(data) {
            if (data.NumFrames <= 0) {
                row.find('.psiDurationSeconds').html(0);
                row.find('.humanDuration').html('<b>Length: </b>??:??');
                return;
            }

            durationInSeconds = 1.0 * data.NumFrames / (1000 / data.StepTime);
            if (updateUI) {
                var humanDuration = SecondsToHuman(durationInSeconds);

                row.find('.psiDurationSeconds').html(durationInSeconds);
                row.find('.humanDuration').html('<b>Length: </b>' + humanDuration);

                UpdatePlaylistDurations();
            }
        },
        error: function() {
            durationInSeconds = -1;
            row.find('.humanDuration').html('');
            row.find('.psiDataSimple').append('<span style="color: #FF0000; font-weight: bold;">ERROR: Sequence "' + sequence + '" Not Found</span><br>');
            row.find('.psiData').append('<div style="color: #FF0000; font-weight: bold;">ERROR: Sequence "' + sequence + '" Not Found</div>');
        }
    });

    return durationInSeconds;
}

function SetPlaylistItemMetaData(row) {
    var type = row.find('.entryType').html();
    var file = row.find('.field_mediaName').html();

    if (((type == 'both') || (type == 'media')) &&
        (typeof file != 'undefined')) {
        file = $('<div/>').html(file).text(); // handle any & or other chars that got converted
        $.get('api/media/' + encodeURIComponent(file) + '/duration', function(mdata) {
            var duration = -1;

            if ((mdata.hasOwnProperty(file)) &&
                (mdata[file].hasOwnProperty('duration'))) {
                duration = mdata[file].duration;
            }

            if (type == 'both') {
                var sDuration = GetSequenceDuration(row.find('.field_sequenceName').html(), false, row);

                // Playlist/PlaylistEntryBoth.cpp ends whenever shortest item ends
                if ((duration > sDuration) || (duration < 0))
                    duration = sDuration;
            }

            if (duration > 0) {
                var humanDuration = SecondsToHuman(duration);

                row.find('.psiDurationSeconds').html(duration);
                row.find('.humanDuration').html('<b>Length: </b>' + humanDuration);

                UpdatePlaylistDurations();
            } else {
                row.find('.humanDuration').html('');
            }
        }).fail(function() {
            row.find('.humanDuration').html('');
            row.find('.psiDataSimple').append('<span style="color: #FF0000; font-weight: bold;">ERROR: Media File "' + file + '" Not Found</span><br>');
            row.find('.psiData').append('<div style="color: #FF0000; font-weight: bold;">ERROR: Media File "' + file + '" Not Found</div>');

            if (type == 'both')
                GetSequenceDuration(row.find('.field_sequenceName').html(), false, row);
        });
    } else if (type == 'sequence') {
        GetSequenceDuration(row.find('.field_sequenceName').html(), true, row);
    } else if (type == 'playlist') {
        $.ajax({
            url: "api/playlist/" + row.find('.field_name').html(),
            type: 'GET',
            async: false,
            dataType: 'json',
            success: function(data) {
                if (data.hasOwnProperty('playlistInfo')) {
                    var duration = data.playlistInfo.total_duration;
                    var humanDuration = SecondsToHuman(duration);

                    row.find('.psiDurationSeconds').html(duration);
                    row.find('.humanDuration').html('<b>Length: </b>' + humanDuration);

                    UpdatePlaylistDurations();
                }
            }
        });
    }
}

function PopulatePlaylistItemDuration(row, editMode) {
    var type = row.find('.entryType').html();

    if (!editMode) {
        var duration = row.find('.psiDurationSeconds').html();
        if (duration != "0")
            return;
    }

    SetPlaylistItemMetaData(row);

    if (type == 'pause') {
        var duration = parseFloat(row.find('.field_duration').html());
        row.find('.psiDurationSeconds').html(duration);
        row.find('.humanDuration').html('<b>Length: </b>' + SecondsToHuman(duration));
        UpdatePlaylistDurations();
    }
}

function AddPlaylistEntry(mode) {
    if (mode && !$('#tblPlaylistDetails').find('.playlistSelectedEntry').length) {
        DialogError('No playlist item selected', "Error: No playlist item selected.");
        return;
    }

    $('#tblPlaylistMainPlaylistPlaceHolder').remove();

    var type = $('#pe_type').val();
    var pet = playlistEntryTypes[type];

    var pe = {};
    pe.type = type;
    pe.enabled = 1;  // no way to disable currently, so force this
    pe.playOnce = 0; // Not currently used by player

    var keys = Object.keys(pet.args);
    for (var i = 0; i < keys.length; i++) {
        var a = pet.args[keys[i]];

        var style = $('#playlistEntryOptions').find('.arg_' + a.name).parent().parent().attr('style');
        if ((typeof style != 'undefined') && (style.includes('display: none;'))) {
            continue;
        }

        if (a.type == 'int') {
            pe[a.name] = parseInt($('#playlistEntryOptions').find('.arg_' + a.name).val());
        } else if (a.type == 'float') {
            pe[a.name] = parseFloat($('#playlistEntryOptions').find('.arg_' + a.name).val());
        } else if (a.type == 'bool') {
            pe[a.name] = $('#playlistEntryOptions').find('.arg_' + a.name).is(':checked') ? 'true' : 'false';
        } else if ((a.type == 'time') || (a.type == 'date')) {
            pe[a.name] = $('#playlistEntryOptions').find('.arg_' + a.name).val();
        } else if (a.type == 'array') {
            var f = {};
            for (x = 0; x < a.keys; x++) {
                f[a.keys[x]] = $('#playlistEntryOptions').find('.arg_' + a.name + '_' + a.keys[x]).val();
            }
            pe[a.name] = f;
        } else if (a.type == 'args') {
            var arr = [];
            if (type == 'command') {
                for (var c = 0; c < commandList.length; c++) {
                    if (commandList[c]['name'] == $('#playlistEntryOptions_arg_1').val()) {
                        var json = {};
                        CommandToJSON("playlistEntryOptions_arg_1", "playlistEntryCommandOptions", json);
                        arr = json["args"];
                        pe["multisyncCommand"] = json["multisyncCommand"];
                        pe["multisyncHosts"] = json["multisyncHosts"];
                    }
                };
            } else {
                for (x = 1; x <= 20; x++) {
                    if ($('#playlistEntryCommandOptions_arg_' + x).length) {
                        arr.push($('#playlistEntryCommandOptions_arg_' + x).val());
                    }
                }
            }
            pe[a.name] = arr;
        } else if ((a.type == 'string') || (a.type == 'file')) {
            pe[a.name] = $('#playlistEntryOptions').find('.arg_' + a.name).val();
        } else {
            pe[a.name] = $('#playlistEntryOptions').find('.arg_' + a.name).html();
        }
    }

    var newRow;
    var html = GetPlaylistRowHTML(0, pe, 1);
    if (mode == 1) { // replace
        var row = $('#tblPlaylistDetails').find('.playlistSelectedEntry');
        $(row).after(html);
        $(row).removeClass('playlistSelectedEntry');
        newRow = $(row).next();
        newRow.addClass('playlistSelectedEntry');
        $(row).remove();
    } else if (mode == 2) { // insert before
        var row = $('#tblPlaylistDetails').find('.playlistSelectedEntry');
        $(row).before(html);
        $(row).removeClass('playlistSelectedEntry');
        newRow = $(row).prev();
        newRow.addClass('playlistSelectedEntry');
    } else if (mode == 3) { // insert after
        var row = $('#tblPlaylistDetails').find('.playlistSelectedEntry');
        $(row).after(html);
        $(row).removeClass('playlistSelectedEntry');
        newRow = $(row).next();
        newRow.addClass('playlistSelectedEntry');
    } else {
        $('#tblPlaylistMainPlaylist').append(html);

        $('#tblPlaylistDetails tr').removeClass('playlistSelectedEntry');

        newRow = $('#tblPlaylistMainPlaylist > tr').last();
        $(newRow).addClass('playlistSelectedEntry');
    }

    RenumberPlaylistEditorEntries();

    PopulatePlaylistItemDuration($(newRow), 1);

    if (type == 'pause')
        UpdatePlaylistDurations();

    VerbosePlaylistItemDetailsToggled();
}

function GetPlaylistEntry(row) {
    var e = {};
    e.type = $(row).find('.entryType').html();
    e.enabled = 1;  // no way to disable currently, so force this
    e.playOnce = 0; // Not currently used by player

    var pet = playlistEntryTypes[e.type];
    var haveDuration = 0;

    var keys = Object.keys(pet.args);
    for (var i = 0; i < keys.length; i++) {
        var a = pet.args[keys[i]];

        if ((a.type != 'args') && (!$(row).find('.field_' + a.name).length)) {
            // handle new fields by using default for fields we can't find
            if (typeof a.default != "undefined")
                e[a.name] = a.default;
            continue;
        }

        if (a.type == 'int') {
            e[a.name] = parseInt($(row).find('.field_' + a.name).html());

            if (a.name == 'duration')
                haveDuration = 1;
        } else if (a.type == 'float') {
            e[a.name] = parseFloat($(row).find('.field_' + a.name).html());

            if (a.name == 'duration')
                haveDuration = 1;
        } else if (a.type == 'bool') {
            e[a.name] = ($(row).find('.field_' + a.name).html() == 'true') ? true : false;
        } else if (a.type == 'array') {
            var f = {};
            for (var x = 0; x < a.keys.length; x++) {
                f[a.keys[x]] = parseInt($(row).find('.field_' + a.name + '_' + a.keys[x]).html());
            }
            e[a.name] = f;
        } else if (a.type == 'args') {
            var arr = [];
            for (x = 1; x <= 20; x++) {
                if ($(row).find('.field_args_' + x).length) {
                    arr.push($(row).find('.field_args_' + x).text());
                }
            }
            e[a.name] = arr;
        } else if (a.type == 'string') {
            var v = $(row).find('.field_' + a.name).text();
            if (parseInt(v) == v) {
                e[a.name] = parseInt(v);
            } else {
                e[a.name] = v;
            }
        } else {
            e[a.name] = $(row).find('.field_' + a.name).text();
        }
    }

    if ((!haveDuration) && ($(row).find('.psiDurationSeconds').html() != "0"))
        e['duration'] = parseFloat($(row).find('.psiDurationSeconds').html());

    return e;
}
function AddPlaylist(filter, callback) {
    var name = $('#txtAddPlaylistName').val();
    if (name == "") {
        alert("Playlist name cannot be empty");
        return;
    }

    return SavePlaylistAs(name, filter, callback);
}
function SavePlaylist(filter, callback) {
    var name = $('#txtPlaylistName').val();
    if (name == "") {
        alert("Playlist name cannot be empty");
        return;
    }

    return SavePlaylistAs(name, filter, callback);
}

function SetPlaylistName(name) {
    if (name) { 
        $('#txtPlaylistName').val(name);
        $('#txtPlaylistName').prop('size', name.length);
    }
}

function SavePlaylistAs(name, options, callback) {
    if (!PlaylistNameOK(name))
        return 0;

    var itemCount = 0;
    var pl = {};
    pl.name = name;
    pl.version = 3;   // v1 == CSV, v2 == JSON, v3 == deprecated some things
    pl.repeat = 0;    // currently unused by player
    pl.loopCount = 0; // currently unused by player
    pl.empty = false;
    pl.desc = $('#txtPlaylistDesc').val();
    pl.random = parseInt($('#randomizePlaylist').prop('value'));
    console.log(options,typeof options)
    if(typeof options === 'object'){
        
        $.extend(pl,options)
    }

    var leadIn = [];
    var mainPlaylist = [];
    var leadOut = [];
    var playlistInfo = {};
    

    if(pl.empty==false){
        $('#tblPlaylistLeadIn > tr:not(.unselectable)').each(function() {
            leadIn.push(GetPlaylistEntry(this));
        });

        $('#tblPlaylistMainPlaylist > tr:not(.unselectable)').each(function() {
            mainPlaylist.push(GetPlaylistEntry(this));
        });          
    
        $('#tblPlaylistLeadOut > tr:not(.unselectable)').each(function() {
            leadOut.push(GetPlaylistEntry(this));
        });
   
        playlistInfo.total_duration = parseFloat($('#playlistDuration').html());
        playlistInfo.total_items = mainPlaylist.length;
        
    }else{
        playlistInfo.total_duration = parseFloat(0);
        playlistInfo.total_items = 0;   
    }
    pl.leadIn = leadIn;
    pl.mainPlaylist = mainPlaylist;
    pl.leadOut = leadOut;
    pl.playlistInfo = playlistInfo;

    
    var str = JSON.stringify(pl, true);
    $.ajax({
        url: "api/playlist/" + name,
        type: 'POST',
        contentType: 'application/json',
        data: str,
        async: false,
        dataType: 'json',
        success: function(data) {
            var rowSelected = $('#tblPlaylistDetails').find('.playlistSelectedEntry').length;

            PopulateLists();
            EnableButtonClass('playlistEditButton');

            if (rowSelected) {
                EnableButtonClass('playlistDetailsEditButton');
            } else {
                DisableButtonClass('playlistDetailsEditButton');
            }

            SetPlaylistName(name);

            if ($('#tblPlaylistDetails').find('.playlistSelectedEntry').length)
                EditPlaylistEntry();

            $.jGrowl("Playlist Saved",{themeState:'success'});
            if(typeof callback==='function'){
                callback();
            }
        },
        error: function() {
            DialogError('Unable to save playlist', "Error: Unable to save playlist.");
        }
    });

    return 1;
}

function RandomizePlaylistEntries() {
    $('#randomizeBuffer').html($('#tblPlaylistMainPlaylist').html());
    $('#tblPlaylistMainPlaylist').empty();

    var itemsLeft = $('#randomizeBuffer > tr').length;
    while (itemsLeft > 0) {
        var x = Math.floor(Math.random() * Math.floor(itemsLeft)) + 1;
        var item = $('#randomizeBuffer > tr:nth-child(' + x + ')').clone();
        $('#randomizeBuffer > tr:nth-child(' + x + ')').remove();

        $('#tblPlaylistMainPlaylist').append(item);

        itemsLeft = $('#randomizeBuffer > tr').length;
    }

    RenumberPlaylistEditorEntries();

//    $('.playlistEntriesBody').sortable('refresh').sortable('refreshPositions');
}

function GetTimeZone() {
    $.get('https://ipapi.co/json/'
    ).done(function(data) {
        $('#TimeZone').val(data.timezone).change();
    }).fail(function() {
        DialogError("Time Zone Lookup", "Time Zone lookup failed.");
    });
}

function GetGeoLocation() {
    $.get('https://ipapi.co/json/'
    ).done(function(data) {
        $('#Latitude').val(data.latitude).change();
        $('#Longitude').val(data.longitude).change();
    }).fail(function() {
        DialogError("GeoLocation Lookup", "GeoLocation lookup failed.");
    });
}

function ViewLatLon()
{
    var lat = $('#Latitude').val();
    var lon = $('#Longitude').val();

    var url = 'https://www.google.com/maps/@' + lat + ',' + lon + ',15z';
    window.open(url, '_blank');
}

/**
 * Removes any of the following characters from the supplied name, can be used to cleanse playlist names, event names etc
 * Current needed for example it the case of the scheduler since it is still CSV and commas in a playlist name cause issues
 * Everything is currently replaced with a hyphen ( - )
 *
 * Currently unused in the front-end
 */
function RemoveIllegalChars(name) {

    // , (comma)
    // < (less than)
    // > (greater than)
    // : (colon)
    // " (double quote)
    // / (forward slash)
    // \ (backslash)
    // | (vertical bar or pipe)
    // ? (question mark)
    // * (asterisk)

    var illegalChars = [',', '<', '>', ':', '"', '/', '\\', '|', '?', '*'];

    for(ill_index = 0; ill_index < illegalChars.length; ++ill_index) {
        name = name.toString().replace(illegalChars[ill_index], " - ");
    }

    return name;
}

function CopyPlaylist()	{
    var name = $('#txtPlaylistName').val();

    $("#copyPlaylist_dialog").fppDialog({
        width: 400,
        buttons: {
            "Copy": function() {
                var new_playlist_name = $(this).find(".newPlaylistName").val();

                if (name == new_playlist_name) {
                    DialogError('Error, same name given', 'Identical name given.');
                    return;
                }

                if (!SavePlaylistAs(new_playlist_name, '', ''))
                    return;

                PopulateLists();
                SetPlaylistName(new_playlist_name);
                $(this).fppDialog("close");
            },
            Cancel: function() {

                $(this).fppDialog("close");
            }
        },
        open: function (event, ui) {
            //Generate a name for the new playlist
            $(this).find(".newPlaylistName").val(name + " - Copy");
        },
        close: function () {
            $(this).find(".newPlaylistName").val("New Playlist Name");
        }
    });
}

function RenamePlaylist()	{
    var name = $('#txtPlaylistName').val();

    $("#renamePlaylist_dialog").fppDialog({
        width: 400,
        title:'Rename Playlist',
        buttons: {
           
            "Rename": function() {
                var new_playlist_name = $(this).find(".newPlaylistName").val();

                if (name == new_playlist_name) {
                    DialogError('Error, same name given', 'Identical name given.');
                    return;
                }

                if (!SavePlaylistAs(new_playlist_name, '', ''))
                    return;

                DeleteNamedPlaylist(name);
                PopulateLists();

                SetPlaylistName(new_playlist_name);
                $(this).fppDialog("close");
            },
            Cancel: function() {
                $(this).fppDialog("close");
            }
        },
        open: function (event, ui) {
            //Generate a name for the new playlist
            $(this).find(".newPlaylistName").val(name);
        },
        close: function () {
            $(this).find(".newPlaylistName").val("New Playlist Name");
        }
    });
}

function DeletePlaylist(options) {
    var name = $('#txtPlaylistName').val();

    DeleteNamedPlaylist(name,options);
}

function DeleteNamedPlaylist(name,options) {
    var postDataString = "";
    $.ajax({
        dataType: "json",
        url: "api/playlist/" + name,
        type: "DELETE",
        async: false,
        success: function(data) {
            PopulateLists(options);
            $.jGrowl("Playlist Deleted",{themeState:'success'});
        },
        error: function() {
            DialogError('Error Deleting Playlist', "Error deleting '" + name + "' playlist");
        }
    });
}

function AssignPlaylistEditorFPPCommandArgsFromList(row, c) {
    for (var x = 0; x < commandList[c]['args'].length; x++) {
        var a = commandList[c]['args'][x];
        if (a.type == 'bool') {
            if ($(row).find('.field_args_' + (x+1)).html() == 'true')
                $('.arg_' + a.name).prop('checked', true).trigger('change');
            else
                $('.arg_' + a.name).prop('checked', false).trigger('change');
        } else if (a.type == 'int') {
            $('.arg_' + a.name).val(parseInt($(row).find('.field_args_' + (x+1)).html())).trigger('change');
        } else {
            $('.arg_' + a.name).val($(row).find('.field_args_' + (x+1)).html()).trigger('change');
        }
    }
}

function EditPlaylistEntry() {
    if (!$('#tblPlaylistDetails').find('.playlistSelectedEntry').length) {
        DialogError('No playlist item selected', "Error: No playlist item selected.");
        return;
    }

    //$("#playlistEntryProperties").get(0).scrollIntoView();

    var row = $('#tblPlaylistDetails').find('.playlistSelectedEntry');
    var type = $(row).find('.entryType').html();
    var pet = playlistEntryTypes[type];

    $('#pe_type').val(type);
    PlaylistTypeChanged();
    EnableButtonClass('playlistEditButton');

    var keys = Object.keys(pet.args);
    for (var i = 0; i < keys.length; i++) {
        var a = pet.args[keys[i]];

        if (a.hidden == true) {
            continue;
        }

        if (a.type == 'bool') {
            if ($(row).find('.field_' + a.name).text() == 'true')
                $('.arg_' + a.name).prop('checked', true).trigger('change');
            else
                $('.arg_' + a.name).prop('checked', false).trigger('change');
        } else if (a.type == 'args') {
            if (type == 'command') {
                var pe = GetPlaylistEntry(row);
                PopulateExistingCommand(pe, "playlistEntryOptions_arg_1", "playlistEntryCommandOptions");
            } else {
                for (x = 1; x <= 20; x++) {
                    if ($(row).find('.field_args_' + x).length) {
                        $('#playlistEntryCommandOptions_arg_' + x).val($(row).find('.field_args_' + x).text());
                    }
                }
            }
        } else {
            if ($(row).find('.field_' + a.name).length)
                $('.arg_' + a.name).val($(row).find('.field_' + a.name).text()).trigger('change');
        }
    }

    UpdateChildVisibility();
}

function RemovePlaylistEntry()	{
    if (!$('#tblPlaylistDetails').find('.playlistSelectedEntry').length) {
        DialogError('No playlist item selected', "Error: No playlist item selected.");
        return;
    }

    DisableButtonClass('playlistDetailsEditButton');
    $('#tblPlaylistDetails').find('.playlistSelectedEntry').remove();
    RenumberPlaylistEditorEntries();
    UpdatePlaylistDurations();
}

		function reloadPage()
		{
			location.reload(true);
		}

		function PingIP(ip, count)
		{
			if (ip == "")
				return;

				$('#helpText').html("Pinging " + ip + "<br><br>This will take a few seconds to load");
				$('#dialog-help').fppDialog({ height: 600, width: 800, position: { my: 'center', at: 'top', of: window}, title: "Ping " + ip });
			        // Workaround for bug: https://bugs.jqueryui.com/ticket/8741
				$('#dialog-help').fppDialog("option", "position", { my: 'center', of: window});
//				$('#dialog-help').fppDialog( "moveToTop" );

				$.get("ping.php?ip=" + ip + "&count=" + count
				).done(function(data) {
						$('#helpText').html(data);
				}).fail(function() {
						$('#helpText').html("Error pinging " + ip);
				});
		}

		function PingE131IP(id)
		{
			var ip = $("[name='txtIP\[" + id + "\]']").val();

			PingIP(ip, 3);
		}

		function ViewReleaseNotes(version) {
				$('#helpText').html("Retrieving Release Notes");
				$('#dialog-help').fppDialog({ width: 800, title: "Release Notes for FPP v" + version });
				$('#dialog-help').fppDialog( "moveToTop" );

				$.get("api/system/releaseNotes/" + version
				).done(function(data) {
						$('#helpText').html(
						"<center><input onClick='UpgradeFPPVersion(\"" + version + "\");' type='button' class='buttons' value='Upgrade'></center>" +
						"<pre style='white-space: pre-wrap; word-wrap: break-word;'>" + data.body + "</pre>"
						);
				}).fail(function() {
						$('#helpText').html("Error loading release notes.");
				});
		}

        function VersionUpgradeDone(id) {
            id = id.replace('_logText', '');
            $('#' + id + '_doneButtons').show();
            $('#rebootFPPAfterUpgradeButton').show();
        }
		function UpgradeFPPVersion(newVersion)
		{
			if (confirm('Do you wish to upgrade the Falcon Player?\n\nClick "OK" to continue.\n\nThe system will automatically reboot to complete the upgrade.\nThis can take a long time,  20-30 minutes on slower devices.'))
			{
                $('#upgradePopup').fppDialog({ height: 600, width: 900, title: "FPP Upgrade" });
                $('#upgradePopup').fppDialog( "moveToTop" );
                $('#upgradeText').html('');

                StreamURL('upgradefpp.php?version=v' + newVersion, 'upgradeText', 'VersionUpgradeDone');
			}
		}

		function ChangeGitBranch(newBranch)
		{
            location.href="changebranch.php?branch=" + newBranch;
		}

		function RebuildFPPSource()
		{
            location.href="rebuildfpp.php";
		}

		function SetUniverseCount(input)
		{
			var txtCount=document.getElementById("txtUniverseCount");
			var count = Number(txtCount.value);
			if(isNaN(count)) {
				count = 8;
			}

            if (count < UniverseCount) {
                while (count < UniverseCount) {
                    UniverseSelected = UniverseCount - 1;
                    DeleteUniverse(input);
                }
            } else {
                if (UniverseCount == 0) {
                    var data = {};
                    var channelData = {};
                    channelData.enabled = 0;
                    channelData.type = "universes";
                    channelData.universes = [];
                    var universe = {};
                    universe.active = 1;
                    universe.description = "";
                    universe.id = 1;
                    universe.startChannel = 1;
                    universe.channelCount = 512;
                    universe.type = 0;
                    universe.address = "";
                    universe.priority = 0;
                    universe.monitor = 1;
                    universe.deDuplicate = 0;
                    channelData.universes.push(universe);
                    if (input) {
                        data.channelInputs = [];
                        data.channelInputs.push(channelData);
                    } else {
                        data.channelOutputs = [];
                        data.channelOutputs.push(channelData);
                    }
                    populateUniverseData(data, false, input);
                }
                var selectIndex = UniverseCount - 1;
                var universe=Number(document.getElementById("txtUniverse[" + selectIndex + "]").value);
                var universeType=document.getElementById("universeType[" + selectIndex + "]").value;
                var unicastAddress=document.getElementById("txtIP[" + selectIndex + "]").value;
                var size=Number(document.getElementById("txtSize[" + selectIndex + "]").value);
                var ucount=Number(document.getElementById("numUniverseCount[" + selectIndex + "]").value);
                var startAddress=Number(document.getElementById("txtStartAddress[" + selectIndex + "]").value);
                var active=document.getElementById("chkActive[" + selectIndex + "]").value;
                var priority=Number(document.getElementById("txtPriority[" + selectIndex + "]").value);
                var monitor=document.getElementById("txtMonitor[" + selectIndex + "]").checked ? 1 : 0;
                var deDuplicate=document.getElementById("txtDeDuplicate[" + selectIndex + "]").checked ? 1 : 0;

                var tbody=document.getElementById("tblUniversesBody");  //get the table
                var origRow = tbody.rows[selectIndex];
                var origUniverseCount = UniverseCount;
                while (UniverseCount < count) {
                    var row = origRow.cloneNode(true);
                    tbody.appendChild(row);
                    UniverseCount++;
                }
                UniverseCount =  origUniverseCount;
                SetUniverseInputNames();
                while (UniverseCount < count) {
                    if (universe != 0) {
                        universe += ucount;
                        document.getElementById("txtUniverse[" + UniverseCount + "]").value = universe;
                    }
                    startAddress += size * ucount;
                    document.getElementById("txtStartAddress[" + UniverseCount + "]").value = startAddress;

                    if (!input) {
                        document.getElementById("tblUniversesBody").rows[UniverseCount].cells[14].innerHTML = "<input type='button' class='buttons' value='Ping' onClick='PingE131IP(" + UniverseCount + ");'/>";
                    }
                    updateUniverseEndChannel( document.getElementById("tblUniversesBody").rows[UniverseCount]);
                    UniverseCount++;
                }
                document.getElementById("txtUniverseCount").value = UniverseCount;
            }
		}

        function IPOutputTypeChanged(item, input) {
            var type = $(item).val();
            if (type == 4 || type == 5) { // DDP
                var univ = $(item).parent().parent().find("input.txtUniverse");
                univ.prop('disabled', true);
                var univc = $(item).parent().parent().find("input.numUniverseCount");
                univc.prop('disabled', true);
                var sz = $(item).parent().parent().find("input.txtSize");
                sz.prop('max', 512000);

                var monitor = $(item).parent().parent().find("input.txtMonitor");
                monitor.prop('disabled', false);

                var universe = $(item).parent().parent().find("input.txtUniverse");
                universe.prop('min', 1);
            } else { // 0,1 = E1.31, 2,3 = Artnet, 6,7 = KiNet
                var univ = $(item).parent().parent().find("input.txtUniverse");
                univ.prop('disabled', false);
                if (parseInt(univ.val()) < 1) {
                    univ.val(1);
                }
                var univc = $(item).parent().parent().find("input.numUniverseCount");
                univc.prop('disabled', false);
                if (parseInt(univc.val()) < 1) {
                    univc.val(1);
                }
                var sz = $(item).parent().parent().find("input.txtSize");
                var val = parseInt(sz.val());
                if (val > 512) {
                    sz.val(512);
                }
                sz.prop('max', 512);

                if (!input) {
                    if ((type == 0) || (type == 2)) {
                        $(item).parent().parent().find("input.txtIP").val('');
                        $(item).parent().parent().find("input.txtIP").prop('disabled', true);
                    } else {
                        $(item).parent().parent().find("input.txtIP").prop('disabled', false);
                    }

                    var monitor = $(item).parent().parent().find("input.txtMonitor");
                    if (type == 0 || type == 2) {
                        monitor.prop('disabled', true);
                    } else {
                        monitor.prop('disabled', false);
                    }

                    var universe = $(item).parent().parent().find("input.txtUniverse");
                    if (type == 2 || type == 3) {
                        universe.prop('min', 0);
                    } else {
                        universe.prop('min', 1);
                    }
                }
            }
            var priority = $(item).parent().parent().find("input.txtPriority");
            priority.prop('disabled', type > 1);
        }

function updateUniverseEndChannel(row) {
	var startChannel = parseInt($(row).find("input.txtStartAddress").val());
	var count = parseInt($(row).find("input.numUniverseCount").val());
	var size = parseInt($(row).find("input.txtSize").val());
	var end = startChannel + (count * size) - 1;

	$(row).find("span.numEndChannel").html(end);
}

        function populateUniverseData(data, reload, input) {
			var bodyHTML="";
			UniverseCount = 0;
            var inputStyle = "";
            var inputStr = 'Output';
            var anyEnabled = 0;

            // Incase none found
            var channelData = {
                universes: []
            };

            if (input && ("channelInputs" in data)) {
                channelData = data.channelInputs[0];
            } else if ("channelOutputs" in data) {
                channelData = data.channelOutputs[0];
            }

            if (input) {
                inputStr = 'Input';
                inputStyle = "style='display: none;'";
            } else {
                if (channelData.hasOwnProperty("interface")) {
                    $('#selE131interfaces').val(channelData.interface).prop('selected', true);
                }
                if (channelData.hasOwnProperty("threaded")) {
                    $("#E131ThreadedOutput").prop( "checked", channelData.threaded );
                }
            }
            UniverseCount = channelData.universes.length;
            for (var i = 0; i < channelData.universes.length; i++) {
                var universe = channelData.universes[i];
                var active = universe.active;
                var desc = universe.description;
                var uid = universe.id;
                var ucount = universe.universeCount;
                if (!ucount) {
                    ucount = 1;
                }
                var startAddress = universe.startChannel;
                var size = universe.channelCount;
                var type = universe.type;
                var unicastAddress =  universe.address;
                var priority =  universe.priority;
                unicastAddress = unicastAddress.trim();
                var endChannel = universe.startChannel + (ucount * size) - 1;

                var activeChecked = active == 1  ? "checked=\"checked\"" : "";
                var typeMulticastE131 = type == 0 ? "selected" : "";
                var typeUnicastE131 = type == 1 ? "selected": "";
                var typeBroadcastArtNet = type == 2 ? "selected" : "";
                var typeUnicastArtNet = type == 3 ? "selected": "";
                var typeDDPR = type == 4 ? "selected": "";
                var typeDDP1 = type == 5 ? "selected": "";
                var typeKiNet1 = type == 6 ? "selected": "";
                var typeKiNet2 = type == 7 ? "selected": "";
                var monitor = 1;
                if (universe.monitor != null) {
                    monitor = universe.monitor;
                }
                var deDuplicate = 0;
                if (universe.deDuplicate != null) {
                    deDuplicate = universe.deDuplicate;
                }

                var universeSize = 512;
                var universeCountDisable = "";
                var universeNumberDisable = "";
                var monitorDisabled = "";
                var ipDisabled = "";
                if (type == 4 || type == 5) {
                    universeSize = 512000;
                    universeCountDisable = " disabled";
                    universeNumberDisable = " disabled";
                }
                if (type == 0 || type == 2) {
                    monitorDisabled = " disabled";
                }
                var minNum = 1;
                if (type == 2 || type == 3) {
                    minNum = 0;
                }
                if (type == 0 || type == 2) {
                    ipDisabled = " disabled";
                    unicastAddress = "";
                }

                anyEnabled |= active == 1;

                bodyHTML += "<tr>" +
                            '<td valign="middle">  <div class="rowGrip"> <i class="rowGripIcon fpp-icon-grip"></i> </div> </td>'+
                            "<td><span class='rowID' id='rowID'>" + (i+1).toString() + "</span></td>" +
                            "<td><input class='chkActive' type='checkbox' " + activeChecked +"/></td>" +
                            "<td><input class='txtDesc' type='text' size='24' maxlength='64' value='" + desc + "'/></td>";
                bodyHTML += "<td><select class='universeType' style='width:150px'";

                if (input) {
                    bodyHTML += ">" +
                                "<option value='0' " + typeMulticastE131 + ">E1.31 - Multicast</option>" +
                                "<option value='1' " + typeUnicastE131 + ">E1.31 - Unicast</option>" +
                                "<option value='2' " + typeBroadcastArtNet + ">ArtNet</option>";
                } else {
                    bodyHTML += " onChange='IPOutputTypeChanged(this, " + input + ");'>" +
                                "<option value='0' " + typeMulticastE131 + ">E1.31 - Multicast</option>" +
                                "<option value='1' " + typeUnicastE131 + ">E1.31 - Unicast</option>" +
                                "<option value='2' " + typeBroadcastArtNet + ">ArtNet - Broadcast</option>" +
                                "<option value='3' " + typeUnicastArtNet + ">ArtNet - Unicast</option>" +
                                "<option value='4' " + typeDDPR + ">DDP - Raw Channel Numbers</option>" +
                                "<option value='5' " + typeDDP1 + ">DDP - One Based</option>" +
                                "<option value='6' " + typeKiNet1 + ">KiNet v1</option>" +
                                "<option value='7' " + typeKiNet2 + ">KiNet v2</option>";
                }

                bodyHTML += "</select></td>";
                bodyHTML += "<td " + inputStyle + "><input class='txtIP' type='text' value='" + unicastAddress + "' size='16' maxlength='32' " + ipDisabled + "></td>";
                bodyHTML += "<td><input class='txtStartAddress singleDigitInput' type='number' min='1' max='1048576' value='" + startAddress.toString() + "' onChange='updateUniverseEndChannel($(this).parent().parent());' onkeypress='this.onchange();' onpaste='this.onchange();' oninput='this.onchange();'/></td><td><span class='numEndChannel'>" + endChannel.toString() + "</span></td>";

                bodyHTML += "<td><input class='txtUniverse singleDigitInput' type='number' min='" + minNum + "' max='63999' value='" + uid.toString() + "'" + universeNumberDisable + "/></td>";

                bodyHTML += "<td><input class='numUniverseCount singleDigitInput' type='number' min='1' max='999' value='" + ucount.toString() + "'" + universeCountDisable + " onChange='updateUniverseEndChannel($(this).parent().parent());' onkeypress='this.onchange();' onpaste='this.onchange();' oninput='this.onchange();'/></td>";

                bodyHTML += "<td><input class='txtSize' type='number'  min='1'  max='" + universeSize + "' value='" + size.toString() + "' onChange='updateUniverseEndChannel($(this).parent().parent());' onkeypress='this.onchange();' onpaste='this.onchange();' oninput='this.onchange();'></td>";
                bodyHTML += "<td " + inputStyle + "><input class='txtPriority' type='number' min='0' max='9999' value='" + priority.toString() + "'";
                if (type > 1) {
                    //DDP/ArtNet/KiNet don't support priority
                    bodyHTML += " disabled";
                }
                bodyHTML += "/></td>";
                bodyHTML += "<td " + inputStyle + "><input class='txtMonitor' id='txtMonitor' type='checkbox' size='4' maxlength='4' " + (monitor == 1 ? "checked" : "" ) + monitorDisabled + "/></td>" +
                            "<td " + inputStyle + "><input class='txtDeDuplicate' id='txtDeDuplicate' type='checkbox' size='4' maxlength='4' " + (deDuplicate == 1 ? "checked" : "" ) + "/></td>" +
                            "<td " + inputStyle + "><input type=button class='buttons' onClick='PingE131IP(" + i.toString() + ");' value='Ping'></td>" +
                            "</tr>";
            }

            if (!input) {
                var ecb = $('#E131Enabled');
                if ( channelData.enabled == 1) {
                    ecb.prop('checked', true);
                    $('#outputOffWarning').hide();
                } else {
                    ecb.prop('checked', false);
                    if (anyEnabled)
                        $('#outputOffWarning').show();
                }
            }
            $('#tblUniversesBody').html(bodyHTML);

            $('#txtUniverseCount').val(UniverseCount);

            SetUniverseInputNames(); // in co-universes.php
		}
        function getUniverses(reload, input)
        {
            var url = "api/channel/output/universeOutputs";
            if (input) {
                url = "api/channel/output/universeInputs";
            }
            $.getJSON(url, function(data) {
                        populateUniverseData(data, reload, input)
                      }).fail(function() {
                              UniverseCount = 0;
                              $('#txtUniverseCount').val(UniverseCount);
                      })
        }

		function getPixelnetDMXoutputs()
		{
            $.get("api/channel/output/PixelnetDMX"
            ).done(function(data){
                var innerHTML="";
                if (data.length > 0) {
                    innerHTML = "<tr>" +
                    "<th>#</th>" +
                    "<th>Active</th>" +
                    "<th>Type</th>" +
                    "<th>Start</th>" +
                    "</tr>";

                    for (var i=0; i<data.length; i++) {
                        var active = data[i].active;
                        var type = data[i].type;
                        var startAddress = data[i].startAddress;

                        var activeChecked = active == 1  ? "checked=\"checked\"" : "";
                        var pixelnetChecked = type == 0 ? "selected" : "";
                        var dmxChecked = type == 1 ? "selected" : "";

                        innerHTML += 	"<tr class=\"rowUniverseDetails\">" +
                        "<td>" + (i+1).toString() + "</td>" +
                                      "<td><input name=\"FPDchkActive[" + i.toString() + "]\" id=\"FPDchkActive[" + i.toString() + "]\" type=\"checkbox\" " + activeChecked +"/></td>" +
                                      "<td><select id=\"pixelnetDMXtype[" + i.toString() + "]\" name=\"pixelnetDMXtype[" + i.toString() + "]\" style=\"width:150px\">" +
                                            "<option value=\"0\" " + pixelnetChecked + ">Pixelnet</option>" +
                                            "<option value=\"1\" " + dmxChecked + ">DMX</option></select></td>" +
                                      "<td><input name=\"FPDtxtStartAddress[" + i.toString() + "]\" id=\"FPDtxtStartAddress[" + i.toString() + "]\" type=\"text\" size=\"8\" value=\"" + startAddress.toString() + "\"/></td>" +
                                      "</tr>";
                    }
                } else {
                    innerHTML = "No Results Found";
                }
                var results = document.getElementById("tblOutputs");
                results.innerHTML = innerHTML;
            }).fail(function() {
                DialogError('DMX Read Failed', "Failed to read PixelnetDMX outputs");
            });
		}

        function SetUniverseRowInputNames(row, id) {
            var fields = Array('rowGrip','chkActive', 'txtDesc', 'txtStartAddress',
                               'txtUniverse', 'numUniverseCount', 'txtSize', 'universeType', 'txtIP',
                               'txtPriority', 'txtMonitor', 'txtDeDuplicate');
            row.find('span.rowID').html((id + 1).toString());

            for (var i = 0; i < fields.length; i++)
            {
                row.find('input.' + fields[i]).attr('name', fields[i] + '[' + id + ']');
                row.find('input.' + fields[i]).attr('id', fields[i] + '[' + id + ']');
                row.find('select.' + fields[i]).attr('name', fields[i] + '[' + id + ']');
                row.find('select.' + fields[i]).attr('id', fields[i] + '[' + id + ']');
            }
        }
		function SetUniverseInputNames()
		{
            var id = 0;
			$('#tblUniversesBody tr').each(function() {
                SetUniverseRowInputNames($(this), id);
				id += 1;
			});
		}

		function InitializeUniverses()
		{
			UniverseSelected = -1;
			UniverseCount = 0;
		}

		function DeleteUniverse(input)
		{
            if (UniverseSelected >= 0) {
                var selectedIndex = UniverseSelected;
                for(i = UniverseSelected + 1; i < UniverseCount; i++, selectedIndex++) {

                    document.getElementById("txtUniverse[" + selectedIndex + "]").value = document.getElementById("txtUniverse[" + i + "]").value
                    document.getElementById("txtDesc[" + selectedIndex + "]").value = document.getElementById("txtDesc[" + i + "]").value
                    document.getElementById("universeType[" + selectedIndex + "]").value = document.getElementById("universeType[" + i + "]").value;
                    var universeType = document.getElementById("universeType[" + selectedIndex + "]").value;
                    document.getElementById("txtStartAddress[" + selectedIndex + "]").value  = document.getElementById("txtStartAddress[" + i + "]").value;
                    document.getElementById("numUniverseCount[" + selectedIndex + "]").value  = document.getElementById("numUniverseCount[" + i + "]").value;

                    var checkb = document.getElementById("chkActive[" + i + "]");
                    document.getElementById("chkActive[" + selectedIndex + "]").checked = checkb.checked;
                    document.getElementById("txtSize[" + selectedIndex + "]").value = document.getElementById("txtSize[" + i + "]").value;
                    document.getElementById("txtIP[" + selectedIndex + "]").value = document.getElementById("txtIP[" + i + "]").value;
                    document.getElementById("txtPriority[" + selectedIndex + "]").value = document.getElementById("txtPriority[" + i + "]").value;
                    document.getElementById("txtMonitor[" + selectedIndex + "]").checked = document.getElementById("txtMonitor[" + i + "]").checked;
                    document.getElementById("txtDeDuplicate[" + selectedIndex + "]").checked = document.getElementById("txtDeDuplicate[" + i + "]").checked;
                    if ((universeType == '1') || (universeType == '3')) {
                        document.getElementById("txtIP[" + selectedIndex + "]").disabled = false;
                    } else {
                        document.getElementById("txtIP[" + selectedIndex + "]").disabled = true;
                    }
                    updateUniverseEndChannel(document.getElementById("tblUniversesBody").rows[selectedIndex]);
                }
                document.getElementById("tblUniversesBody").deleteRow(UniverseCount-1);
                UniverseCount--;
                document.getElementById("txtUniverseCount").value = UniverseCount;
                UniverseSelected = -1;
            }

        }

		function CloneUniverses(cloneNumber)
		{
			var selectIndex = (UniverseSelected).toString();
			if(!isNaN(cloneNumber))
			{
				if((UniverseSelected + cloneNumber -1) < UniverseCount)
				{
                    var universeDesc=document.getElementById("txtDesc[" + selectIndex + "]").value;
					var universeType=document.getElementById("universeType[" + selectIndex + "]").value;
					var unicastAddress=document.getElementById("txtIP[" + selectIndex + "]").value;
					var size=Number(document.getElementById("txtSize[" + selectIndex + "]").value);
                    var uCount=Number(document.getElementById("numUniverseCount[" + selectIndex + "]").value);
                    var universe=Number(document.getElementById("txtUniverse[" + selectIndex + "]").value)+uCount;
					var startAddress=Number(document.getElementById("txtStartAddress[" + selectIndex + "]").value)+ size * uCount;
					var active=document.getElementById("chkActive[" + selectIndex + "]").value;
					var priority=Number(document.getElementById("txtPriority[" + selectIndex + "]").value);
                    var monitor=document.getElementById("txtMonitor[" + selectIndex + "]").checked ? 1 : 0;
                    var deDuplicate=document.getElementById("txtDeDuplicate[" + selectIndex + "]").checked ? 1 : 0;

					for(z=0;z<cloneNumber;z++,universe+=uCount)
					{
                        var i = z+UniverseSelected+1;
                        i = i.toString();
                        document.getElementById("txtDesc[" + i + "]").value = universeDesc;
						document.getElementById("txtUniverse[" + i + "]").value	= universe.toString();
						document.getElementById("universeType[" + i + "]").value = universeType;
						document.getElementById("txtStartAddress[" + i + "]").value	= startAddress.toString();
                        document.getElementById("numUniverseCount[" + i + "]").value = uCount.toString();
						document.getElementById("chkActive[" + i + "]").value = active;
						document.getElementById("txtSize[" + i + "]").value = size.toString();
						document.getElementById("txtIP[" + i + "]").value = unicastAddress;
						document.getElementById("txtPriority[" + i + "]").value = priority;
                        document.getElementById("txtMonitor[" + i + "]").checked = (monitor == 1);
                        document.getElementById("txtDeDuplicate[" + i + "]").checked = (deDuplicate == 1);
						if((universeType == '1') || (universeType == '3'))
						{
							document.getElementById("txtIP[" + i + "]").disabled = false;
						}
						else
						{
							document.getElementById("txtIP[" + i + "]").disabled = true;
						}
						updateUniverseEndChannel(document.getElementById("tblUniversesBody").rows[i]);
						startAddress+=size*uCount;
					}
				}
			} else {
				DialogError("Clone Universe", "Error, invalid number");
			}
		}
        function CloneUniverse()
        {
            var answer = prompt ("How many universes to clone from selected universe?","1");
            var cloneNumber = Number(answer);
            CloneUniverses(cloneNumber);
        }

		function ClonePixelnetDMXoutput()
		{
			var answer = prompt ("How many outputs to clone from selected output?","1");
			var cloneNumber = Number(answer);
			var selectIndex = (PixelnetDMXoutputSelected-1).toString();
			if(!isNaN(cloneNumber))
			{
				if((PixelnetDMXoutputSelected + cloneNumber -1) < 12)
				{
					var active=document.getElementById("FPDchkActive[" + selectIndex + "]").value;
					var pixelnetDMXtype=document.getElementById("pixelnetDMXtype[" + selectIndex + "]").value;
					var size = pixelnetDMXtype == "0" ? 4096:512;
					var startAddress=Number(document.getElementById("FPDtxtStartAddress[" + selectIndex + "]").value)+ size;
					for(i=PixelnetDMXoutputSelected;i<PixelnetDMXoutputSelected+cloneNumber;i++)
					{
						document.getElementById("pixelnetDMXtype[" + i + "]").value	 = pixelnetDMXtype;
						document.getElementById("FPDtxtStartAddress[" + i + "]").value	 = startAddress.toString();
						document.getElementById("FPDchkActive[" + i + "]").value = active;
						startAddress+=size;
					}
					$.jGrowl("" + cloneNumber + " Outputs Cloned",{themeState:'success'});
				}
			} else {
				DialogError("Clone Output", "Error, invalid number",{themeState:'success'});
			}
		}

function postUniverseJSON(input) {
    var postData = {};
    var anyEnabled = 0;

    var output = {};
    output.type = "universes";
    if (!input) {
        output.enabled = document.getElementById("E131Enabled").checked ? 1 : 0;
        output.interface = document.getElementById("selE131interfaces").value;
        output.threaded = document.getElementById("E131ThreadedOutput").checked ? 1 : 0;
    } else {
        output.enabled = 1;
    }
    output.startChannel = 1;
    output.channelCount = -1;
    output.universes = [];

    var i;
    for (i = 0; i < UniverseCount; i++) {
        var universe = {};
        universe.active = document.getElementById("chkActive[" + i + "]").checked ? 1 : 0;
        anyEnabled |= universe.active;
        universe.description = document.getElementById("txtDesc[" + i + "]").value;;
        universe.id = parseInt(document.getElementById("txtUniverse[" + i + "]").value);
        universe.startChannel = parseInt(document.getElementById("txtStartAddress[" + i + "]").value);
        universe.universeCount = parseInt(document.getElementById("numUniverseCount[" + i + "]").value);

        universe.channelCount = parseInt(document.getElementById("txtSize[" + i + "]").value);
        universe.type = parseInt(document.getElementById("universeType[" + i + "]").value);
        universe.address = document.getElementById("txtIP[" + i + "]").value;
        universe.priority = parseInt(document.getElementById("txtPriority[" + i + "]").value);
        if (!input) {
            universe.monitor = document.getElementById("txtMonitor[" + i + "]").checked ? 1 : 0;
            universe.deDuplicate = document.getElementById("txtDeDuplicate[" + i + "]").checked ? 1 : 0;
        }
        output.universes.push(universe);
    }
    if (input) {
        postData.channelInputs = [];
        postData.channelInputs.push(output);
    } else {
        postData.channelOutputs = [];
        postData.channelOutputs.push(output);
    }
    var fileName = input ? 'universeInputs' : 'universeOutputs';
    var postDataString = JSON.stringify(postData);

    if (anyEnabled && !output.enabled)
        $('#outputOffWarning').show();
    else
        $('#outputOffWarning').hide();

    $.post("api/channel/output/" + fileName, postDataString).done(function (data) {
        $.jGrowl("E1.31 Universes Saved",{themeState:'success'});
        SetRestartFlag(2);
        CheckRestartRebootFlags();
    }).fail(function () {
        DialogError('Save Universes', "Error: Unable to save E1.31 Universes.");
    });

}

		function validateUniverseData()
		{
			var i;
			var txtUniverse;
			var txtStartAddress;
			var txtSize;
			var universeType;
			var txtPriority;
			var result;
			var returnValue=true;
			for(i=0;i<UniverseCount;i++)
			{

                // unicast address
                universeType=document.getElementById("universeType[" + i + "]").value;
                if(universeType == 1 || universeType == 3 || universeType == 4 || universeType == 5)
                {
                    if(!validateIPaddress("txtIP[" + i + "]"))
                    {
                        returnValue = false;
                    }
                }
				// universe
                if (universeType >= 0 && universeType <= 3) {
                    txtUniverse=document.getElementById("txtUniverse[" + i + "]");
                    var minNum = 1;
                    if (universeType >= 2 && universeType <= 3)
                        minNum = 0;

                    if(!validateNumber(txtUniverse,minNum,63999))
                    {
                        returnValue = false;
                    }
                }
				// start address
				txtStartAddress=document.getElementById("txtStartAddress[" + i + "]");
				if(!validateNumber(txtStartAddress,1,1048576))
				{
					returnValue = false;
				}
                // size
                txtSize=document.getElementById("txtSize[" + i + "]");
                var max = 512;
                if (universeType == 4 || universeType == 5) {
                    max = 512000;
                }
                if(!validateNumber(txtSize,1,max))
                {
                    returnValue = false;
                }

				// priority
				txtPriority=document.getElementById("txtPriority[" + i + "]");
				if(!validateNumber(txtPriority,0,9999))
				{
					returnValue = false;
				}
			}
			return returnValue;
		}

		function validateIPaddress(id)
		{
			var ipb = document.getElementById(id);
			var ip = ipb.value;
			var isHostnameRegex = /[a-z]/i;
			var isHostname = ip.match(isHostnameRegex);
			if ((ip == "") || ((isHostname == null) || (isHostname.length > 0)) || (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip)))
			{
				ipb.style.border = "#000 0px none";
				return true;
			}

			ipb.style.border = "#F00 2px solid";
			return false;
		}

		function validateNumber(textbox,minimum,maximum)
		{
			result = true;
			value = Number(textbox.value);
			if(isNaN(value))
			{
				textbox.style.border="red solid 1px";
				textbox.value = "";
				result = false;
			}
			if(value >= minimum && value <= maximum)
			{
				return true;
			}
			else
			{
				textbox.style.border="red solid 1px";
				textbox.value = "";
				result = false;
			alert(textbox.value + ' is not between ' + minimum + ' and ' + maximum);
			}
		}

		function ReloadPixelnetDMX()
		{
			getPixelnetDMXoutputs("TRUE");
		}

		function ExtendSchedule(minutes)
		{
			var seconds = minutes * 60;
			var url = "api/command/Extend Schedule/" + seconds;
			$.get(url).done(function(data) {
					$.jGrowl(data,{themeState:'success'});
					if (statusTimeout != null)
						clearTimeout(statusTimeout);
					GetFPPStatus();
				}).fail(function() {
					$.jGrowl("Failed to extend schedule.",{themeState:'danger'});
				});
		}

		function ExtendSchedulePopup()
		{
			var minutes = prompt ("Extend running scheduled playlist by how many minutes?","1");
			if (minutes === null) {
				$.jGrowl("Extend cancelled",{themeState:'danger'});
				return;
			}

			minutes = Number(minutes);

			var minimum = -3 * 60;
			var maximum = 12 * 60;

			if ((minutes > maximum) ||
				(minutes < minimum)) {
				DialogError("Extend Schedule", "Error: Minutes is not between the minimum " + minimum + " and maximum " + maximum);
			} else {
				ExtendSchedule(minutes);
			}
		}


var playListArray = [];
function GetPlaylistArray(callback)
{
    $.ajax({
        dataType: "json",
        url: "api/playlists",
        async: false,
        success: function(data) {
            playListArray = data;
            if(typeof callback === 'function'){
                callback();
            }
        },
        error: function() {
            DialogError('Load Playlists', 'Error loading list of playlists');
        }
    });
}

var sequenceArray = [];
function GetSequenceArray()
{
    $.ajax({
        dataType: "json",
        url: "api/sequence",
        async: false,
        success: function(data) {
            sequenceArray = data;
        },
        error: function() {
            DialogError('Load Sequences', 'Error loading list of sequences');
        }
    });
}

  function GetFiles(dir)
  {
    $.ajax({
        dataType: "json",
        url: "api/files/" + dir,
        success: function(data) {
            let i = 0;
            $('#tbl' + dir).html('');
            data.files.forEach(function(f) {
                var detail = f.sizeHuman;
                if ("playtimeSeconds" in f) {
                    detail = f.playtimeSeconds;
                }

                var tableRow = "<tr class='fileDetails' id='fileDetail_" + i + "'><td class ='fileName'>" + f.name + "</td><td class='fileExtraInfo'>" + detail + "</td><td class ='fileTime'>" + f.mtime + "</td></tr>";
                $('#tbl' + dir).append(tableRow);
                ++i;
            });
        },
        error: function() {
            DialogError('Load Sequences', 'Error loading list of sequences');
        }

    });
}

function moveFile(file) {
    $.get("api/file/move/" + encodeURIComponent(file)
    ).done(function (data) {
        if ("OK" != data.status) {
            DialogError('File Move Error', data.status);
        }
    }).fail(function (data) {
        DialogError('File Move Error', "Unexpected error while to move file");
    });
}

	function updateFPPStatus()
	{
		var status = GetFPPStatus();
	}

	function IsFPPDrunning()
	{
        var ret = 'false';
        if (lastStatusJSON) {
            if (("fppd" in lastStatusJSON) && (lastStatusJSON.fppd == 'running') ) {
                ret = 'true';
            }
            if (("status_name" in lastStatusJSON) && (lastStatusJSON.status_name == 'updating') ) {
                ret = 'updating';
            }            
        }

        if(ret == 'true')
        {
            SetButtonState('#btnDaemonControl','enable');
            $("#btnDaemonControl").html("<i class='fas fa-fw fa-stop fa-nbsp'></i>Stop FPPD").attr('value', 'Stop FPPD');
            $('#daemonStatus').html("FPPD is running.");
        }
        else if (ret == 'updating')
        {
            SetButtonState('#btnDaemonControl','disable');
            $("#btnDaemonControl").html("<i class='fas fa-fw fa-play fa-nbsp'></i>Start FPPD").attr('value', 'Start FPPD');
            $('#daemonStatus').html("FPP is currently updating.");
        }
        else
        {
            SetButtonState('#btnDaemonControl','enable');
            $("#btnDaemonControl").html("<i class='fas fa-fw fa-play fa-nbsp'></i>Start FPPD").attr('value', 'Start FPPD');
            $('#daemonStatus').html("FPPD is stopped.");
            $('.schedulerStartTime').hide();
            $('.schedulerEndTime').hide();
        }
	}

	function SetupUIForMode(fppMode)
	{
		if (fppMode == 1) // Bridge Mode
		{
            $("#playerModeInfo").hide();
			$("#remoteModeInfo").hide();
			$("#bridgeModeInfo").show();
		}
		else if (fppMode == 8) // Remote Mode
		{
			$("#playerModeInfo").hide();
			$("#remoteModeInfo").show();
			$("#bridgeModeInfo").hide();
		}
		else // Player or Master Modes
		{
			$("#playerModeInfo").show();
			$("#remoteModeInfo").hide();
			$("#bridgeModeInfo").hide();
		}
        $("body").removeClass('is-loading');
	}

    var temperatureUnit = settings['temperatureInF'] == 1;
    function changeTemperatureUnit() {
        if (temperatureUnit) {
            SetSetting("temperatureInF", "0", 0, 0);
            temperatureUnit = false;
        } else {
            SetSetting("temperatureInF", "1", 0, 0);
            temperatureUnit = true;
        }
    }
	function GetFPPStatus()	{
		/* $.ajax({
			url: 'api/system/status',
			dataType: 'json',
			success: function(response, reqStatus, xhr) {
				 */
                var response = lastStatusJSON;
				if(response && typeof response === 'object') {
					$("#btnDaemonControl").show();

                    if (response.status_name == 'stopped') {
                        if ( ! ("warnings" in response)) {
                            response.warnings = [];
                        }
                        response.warnings.push('FPPD Daemon is not running');

                        $.get("api/system/volume"
                        ).done(function(data){
                            updateVolumeUI(parseInt(data.volume));
                        }).fail(function(){
                            DialogError('Volume Query Failed', "Failed to query Volume when FPPD stopped");
                        });
						$('#fppTime').html('');
						SetButtonState('#btnDaemonControl','enable');
                        $("#btnDaemonControl").html("<i class='fas fa-fw fa-play fa-nbsp'></i>Start FPPD");
						$('#daemonStatus').html("FPPD is stopped.");
						$('#txtPlayerStatus').html(status);
						$('#playerTime').hide();
						$('#txtSeqFilename').html("");
						$('#txtMediaFilename').html("");
						$('#schedulerStatus').html("");
						$('.schedulerStartTime').hide();
						$('.schedulerEndTime').hide();
                        $('#mqttRow').hide()
                        updateWarnings(response);

                    } else if (response.status_name == 'updating') {
						$('#fppTime').html('');
						SetButtonState('#btnDaemonControl','disable');
                        $("#btnDaemonControl").html("<i class='fas fa-fw fa-play fa-nbsp'></i>Start FPPD");
						$('#daemonStatus').html("FPP is currently updating.");
						$('#txtPlayerStatus').html(status);
						$('#playerTime').hide();
						$('#txtSeqFilename').html("");
						$('#txtMediaFilename').html("");
						$('#schedulerStatus').html("");
						$('.schedulerStartTime').hide();
						$('.schedulerEndTime').hide();
                        $('#mqttRow').hide()

                    } else {
						SetButtonState('#btnDaemonControl','enable');
                        $("#btnDaemonControl").attr("<i class='fas fa-fw fa-stop fa-nbsp'></i>Stop FPPD");
                        $('#daemonStatus').html("FPPD is running.");
                        parseStatus(response);
					}

					lastStatus = response.status;
				}
/*
			},
			complete: function() {
				clearTimeout(statusTimeout);
				statusTimeout = setTimeout(GetFPPStatus, 1000);
			}
		})
 */
}

function updateWarnings(jsonStatus) {
    if (jsonStatus.hasOwnProperty('warnings')) {
        //var txt = "<hr><center><b>Abnormal Conditions - May Cause Poor Performance</b></center>";
        var txt = "<b>Abnormal Conditions - May Cause Poor Performance</b>";
        for (var i = 0; i < jsonStatus.warnings.length; i++) {
            //txt += "<font color='red'><center>" + jsonStatus.warnings[i] + "</center></font>";
            txt += "<br/>" + jsonStatus.warnings[i];
        }
        document.getElementById('warningsDiv').innerHTML = txt;
        $('#warningsRow').show();
    } else {
        $('#warningsRow').hide();
    }
}


    function modeToString(mode) {
        switch (mode) {
            case 1: return "Bridge";
            case 2: return "Player";
            case 6: return "Master";
            case 8: return "Remote";
        }

        return "Unknown Mode";
    }

function updateVolumeUI(Volume) {
    $('#volume').html(Volume);
    $('#remoteVolume').html(Volume);
    $('#slider').val( Volume);
    $('#remoteVolumeSlider').val(Volume);
    SetSpeakerIndicator(Volume);
}

    var firstStatusLoad = 1;

	function parseStatus(jsonStatus) {
		var fppStatus = jsonStatus.status;
		var fppMode = jsonStatus.mode;
        var status = "Idle";
        if (jsonStatus.status_name == "testing") {
            status = "Testing";
        }
		if (fppStatus == STATUS_IDLE ||
			fppStatus == STATUS_PLAYING ||
            fppStatus == STATUS_PAUSED ||
			fppStatus == STATUS_STOPPING_GRACEFULLY ||
			fppStatus == STATUS_STOPPING_GRACEFULLY_AFTER_LOOP ) {

			$("#btnDaemonControl").show();
            $("#btnDaemonControl").html("<i class='fas fa-fw fa-stop fa-nbsp'></i>Stop FPPD");
			$('#daemonStatus').html("FPPD is running.");
		}

        updateVolumeUI(parseInt(jsonStatus.volume));

        AdjustFPPDModeFromStatus(fppMode);
	if (jsonStatus.hasOwnProperty('MQTT')) {
	   if (jsonStatus.MQTT.configured) {
              $('#mqttRow').show()
	      var mqttConnected = jsonStatus.MQTT.connected ? "Connected" : "Disconnected";
	      $('#mqttStatus').html(mqttConnected);
	   } else {
              $('#mqttRow').hide()
	   }
	} else {
           $('#mqttRow').hide()
	}

    updateWarnings(jsonStatus);

        if (fppMode == 1) {
			// Bridge Mode
			$('#fppTime').html(jsonStatus.time);

			if (firstStatusLoad || $('#e131statsLiveUpdate').is(':checked'))
				GetUniverseBytesReceived();
		} else if (fppMode == 8) {
			// Remote Mode
			$('#fppTime').html(jsonStatus.time);

			if (((jsonStatus.time_elapsed != '00:00') && (jsonStatus.time_elapsed != '')) ||
			    ((jsonStatus.time_remaining != '00:00') && (jsonStatus.time_remaining != ''))) {
				status = "Syncing to Master: Elapsed: " + jsonStatus.time_elapsed + "&nbsp;&nbsp;&nbsp;&nbsp;Remaining: " + jsonStatus.time_remaining;
			} else {
                status = "Waiting for MultiSync commands";
            }

			$('#txtRemoteStatus').html(status);
			$('#txtRemoteSeqFilename').html(jsonStatus.sequence_filename);
			$('#txtRemoteMediaFilename').html(jsonStatus.media_filename);

			if (firstStatusLoad || $('#syncStatsLiveUpdate').is(':checked'))
				GetMultiSyncStats();
		} else {
			// Player/Master Mode
			var nextPlaylist = jsonStatus.next_playlist;
			var nextPlaylistStartTime = jsonStatus.next_playlist_start_time;
			var currentPlaylist = jsonStatus.current_playlist;

			if (fppStatus == STATUS_IDLE) {
				// Not Playing Anything
				gblCurrentPlaylistIndex =0;
				gblCurrentPlaylistEntryType = '';
				gblCurrentPlaylistEntrySeq = '';
				gblCurrentPlaylistEntrySong = '';
				$('#txtPlayerStatus').html(status);
				$('#playerTime').hide();
				$('#txtSeqFilename').html("");
				$('#txtMediaFilename').html("");
				$('#schedulerStatus').html("Idle");
				$('.schedulerStartTime').hide();
				$('.schedulerEndTime').hide();
                $('body').removeClass('schedulderStatusPlaying');

				// Enable Play
				SetButtonState('#btnPlay','enable');
                SetButtonState('#btnStopNow','disable');
                SetButtonState('#btnPrev','disable');
				SetButtonState('#btnNext','disable');
				SetButtonState('#btnStopGracefully','disable');
				SetButtonState('#btnStopGracefullyAfterLoop','disable');
				$('#playlistSelect').removeAttr("disabled");
				UpdateCurrentEntryPlaying(0);
			} else if (currentPlaylist.playlist != "") {
				// Playing a playlist
				var playerStatusText = "Playing ";
                if (fppStatus == STATUS_PAUSED) {
                    playerStatusText = "Paused ";
                }
                if (jsonStatus.current_song != "") {
                    playerStatusText += " - <strong>'" + jsonStatus.current_song + "'</strong>";
                    if (jsonStatus.current_sequence != "") {
                        playerStatusText += "/";
                    }
                }
                if (jsonStatus.current_sequence != "") {
                    if (jsonStatus.current_song == "") {
                        playerStatusText += " - ";
                    }
                    playerStatusText += "<strong>'" + jsonStatus.current_sequence + "'</strong>";
                }
                var repeatMode = jsonStatus.repeat_mode;
				if ((gblCurrentLoadedPlaylist != currentPlaylist.playlist) ||
					(gblCurrentPlaylistIndex != currentPlaylist.index) ||
					(gblCurrentPlaylistEntryType != currentPlaylist.type) ||
					(gblCurrentPlaylistEntrySeq != jsonStatus.current_sequence) ||
					(gblCurrentPlaylistEntrySong != jsonStatus.current_song)) {
					$('#playlistSelect').val(currentPlaylist.playlist);
					PopulatePlaylistDetailsEntries(false,currentPlaylist.playlist);

					gblCurrentPlaylistEntryType = currentPlaylist.type;
					gblCurrentPlaylistEntrySeq = jsonStatus.current_sequence;
					gblCurrentPlaylistEntrySong = jsonStatus.current_song;
				}

				SetButtonState('#btnPlay','enable');
				SetButtonState('#btnStopNow','enable');
                SetButtonState('#btnPrev','enable');
                SetButtonState('#btnNext','enable');
				SetButtonState('#btnStopGracefully','enable');
				SetButtonState('#btnStopGracefullyAfterLoop','enable');
				$('#playlistSelect').attr("disabled");

				if(fppStatus == STATUS_STOPPING_GRACEFULLY) {
					playerStatusText += " - Stopping Gracefully";
				} else if(fppStatus == STATUS_STOPPING_GRACEFULLY_AFTER_LOOP) {
					playerStatusText += " - Stopping Gracefully After Loop";
				}

				$('#txtPlayerStatus').html(playerStatusText);
				$('#playerTime').show();
				$('#txtTimePlayed').html(jsonStatus.time_elapsed );
				$('#txtTimeRemaining').html(jsonStatus.time_remaining );
				$('#txtSeqFilename').html(jsonStatus.current_sequence);
				$('#txtMediaFilename').html(jsonStatus.current_song);

//				if(currentPlaylist.index != gblCurrentPlaylistIndex &&
//					currentPlaylist.index <= gblCurrentLoadedPlaylistCount) {
// FIXME, somehow this doesn't refresh on the first page load, so refresh
// every time for now
if (1) {

							UpdateCurrentEntryPlaying(currentPlaylist.index);
							gblCurrentPlaylistIndex = currentPlaylist.index;
					}

				if (repeatMode) {
					$("#chkRepeat").prop( "checked", true );
				} else{
					$("#chkRepeat").prop( "checked", false );
				}

				if (jsonStatus.scheduler != "") {
					if (jsonStatus.scheduler.status == "playing") {
						var pl = jsonStatus.scheduler.currentPlaylist;
						$('#schedulerStatus').html("Playing <b>'" + pl.playlistName + "'</b>");
                        $('body').addClass('schedulderStatusPlaying');
						$('.schedulerStartTime').show();
						$('#schedulerStartTime').html(pl.actualStartTimeStr.replace(' @ ', '<br>'));
						$('.schedulerEndTime').show();
						$('#schedulerEndTime').html(pl.actualEndTimeStr.replace(' @ ', '<br>'));
						$('#schedulerStopType').html(pl.stopTypeStr);

						if ((fppStatus == STATUS_STOPPING_GRACEFULLY) ||
							(fppStatus == STATUS_STOPPING_GRACEFULLY_AFTER_LOOP)) {
							$('.schedulerExtend').hide();
						} else {
							$('.schedulerExtend').show();
						}

					} else if (jsonStatus.scheduler.status == "manual") {
						var pl = jsonStatus.scheduler.currentPlaylist;
						$('#schedulerStatus').html("Playing <b>'" + pl.playlistName + "'</b> (manually started)");
                        $('body').addClass('schedulderStatusPlaying');
						$('.schedulerStartTime').hide();
						$('.schedulerEndTime').hide();
					} else {
						$('#schedulerStatus').html("Idle");
                        $('body').removeClass('schedulderStatusPlaying');
						$('.schedulerStartTime').hide();
						$('.schedulerEndTime').hide();
					}
				} else {
					$('#schedulerStatus').html("Idle");
                    $('body').removeClass('schedulderStatusPlaying');
					$('#schedulerStartTime').html("N/A");
					$('#schedulerEndTime').html("N/A");
				}
            } else if (jsonStatus.current_sequence != "") {
                //  Playing a sequence via test mode
                var playerStatusText = "Playing ";
                if (fppStatus == STATUS_PAUSED) {
                    playerStatusText = "Paused ";
                }
                playerStatusTest = "<strong>'" + jsonStatus.current_sequence + "'</strong>";
                SetButtonState('#btnPlay','disable');
                SetButtonState('#btnPrev','enable');
                SetButtonState('#btnNext','enable');
                SetButtonState('#btnStopNow','enable');
                SetButtonState('#btnStopGracefully','enable');
                SetButtonState('#btnStopGracefullyAfterLoop','enable');

                $('#txtPlayerStatus').html(playerStatusText);
				$('#playerTime').show();
                $('#txtTimePlayed').html(jsonStatus.time_elapsed );
                $('#txtTimeRemaining').html(jsonStatus.time_remaining );
				$('#txtSeqFilename').html(jsonStatus.current_sequence);
				$('#txtMediaFilename').html(jsonStatus.current_song);

			}
            setTimeout(function(){
                SetHomepageStatusRowWidthForMobile();
            },100);
            
			$('#fppTime').html(jsonStatus.time);

			var npl = jsonStatus.scheduler.nextPlaylist;
			if (npl.scheduledStartTimeStr != "")
				$('#nextPlaylist').html("'" + npl.playlistName + "' on " + npl.scheduledStartTimeStr);
			else
				$('#nextPlaylist').html("No playlist scheduled.");
		}

        if (jsonStatus.hasOwnProperty('sensors')) {
            var sensorText = "<table id='sensorTable'>";
            for (var i = 0; i < jsonStatus.sensors.length; i++) {
                if ((jsonStatus.sensors.length < 4) || ((i % 2) == 0)) {
                    sensorText += "<tr>";
                }
                sensorText += "<th>";
                sensorText += jsonStatus.sensors[i].label;
                sensorText += "</th><td";
                if (jsonStatus.sensors[i].valueType == "Temperature") {
                    sensorText += " onclick='changeTemperatureUnit()'>";
                    var val = jsonStatus.sensors[i].value;
                    if (temperatureUnit) {
                        val *= 1.8;
                        val += 32;
                        sensorText += val.toFixed(1);
                        sensorText += "F";
                    } else {
                        sensorText += val.toFixed(1);
                        sensorText += "C";
                    }
                } else {
                    sensorText += ">";
                    sensorText += jsonStatus.sensors[i].formatted;
                }
                sensorText += "</td>";

                if ((jsonStatus.sensors.length > 4) && ((i % 2) == 1)) {
                    sensorText += "<tr>";
                }
            }
            sensorText += "</table>";
            var sensorData = document.getElementById("sensorData");
            if (typeof sensorData != "undefined" && sensorData != null) {
                sensorData.innerHTML = sensorText;
            }
            $("#sensorData").show();
        }else{
            $("#sensorData").hide();
        }

		firstStatusLoad = 0;
	}

function ShowMultiSyncStats(data) {
    $('#syncStats').empty();

    var master = "<a href='http://" + data.masterIP + "'>" + data.masterIP + "</a>";
    if (data.masterHostname != '')
        master += ' (' + data.masterHostname + ')';

    $('#syncMaster').html(master);

    for (var i = 0; i < data.systems.length; i++) {
        var s = data.systems[i];
        var row = '<tr>'
            + '<td>' + s.sourceIP;

        if (s.hostname != '')
            row += ' (' + s.hostname + ')</td>'

        row += '<td>' + s.lastReceiveTime + '</td>'
            + '<td class="right">' + s.pktSyncSeqOpen + '</td>'
            + '<td class="right">' + s.pktSyncSeqStart + '</td>'
            + '<td class="right">' + s.pktSyncSeqStop + '</td>'
            + '<td class="right">' + s.pktSyncSeqSync + '</td>'
            + '<td class="right">' + s.pktSyncMedOpen + '</td>'
            + '<td class="right">' + s.pktSyncMedStart + '</td>'
            + '<td class="right">' + s.pktSyncMedStop + '</td>'
            + '<td class="right">' + s.pktSyncMedSync + '</td>'
            + '<td class="right">' + s.pktBlank + '</td>'
            + '<td class="right">' + s.pktPing + '</td>'
            + '<td class="right">' + s.pktPlugin + '</td>'
            + '<td class="right">' + s.pktFPPCommand + '</td>'
            + '<td class="right">' + s.pktError + '</td>'
            + '</tr>';

        $('#syncStats').append(row);
    }

    $('#syncStats').trigger('update', true);
}

function ResetMultiSyncStats()
{
    $.get('api/fppd/multiSyncStats?reset=1', function(data) {
        ShowMultiSyncStats(data);
    });
}

function GetMultiSyncStats()
{
    $.get('api/fppd/multiSyncStats', function(data) {
        ShowMultiSyncStats(data);
    });
}

function GetUniverseBytesReceived() {
    var html = [];
    var html1 = '';
    $.get("api/channel/input/stats"
    ).done(function (data) {
        if (data.status == "OK") {
            var maxRows = data.universes.length / 2;
            if (maxRows < 32) {
                maxRows = 32;
            }
            if (data.universes.length > 0) {
                html.push('<table class="fppBasicTable">');
                html.push("<thead><tr id=\"rowReceivedBytesHeader\"><th>Universe</th><th>Start Address</th><th>Packets</th><th>Bytes</th><th>Errors</th></tr></thead><tbody>");
            }
            for (i = 0; i < data.universes.length; i++) {
                if (i == maxRows) {
                    html.push("</table>");
                    html1 = html.join('');
                    html = [];
                    html.push('<table>');
                    html.push("<thead><tr id=\"rowReceivedBytesHeader\"><th>Universe</th><th>Start Address</th><th>Packets</th><th>Bytes</th><th>Errors</th></tr></thead><tbody>");
                }
                html.push('<tr><td>');
                html.push(data.universes[i].id);
                html.push('</td><td>');
                html.push(data.universes[i].startChannel);
                html.push('</td><td>');
                html.push(data.universes[i].packetsReceived);
                html.push('</td><td>');
                html.push(data.universes[i].bytesReceived);
                html.push('</td><td>');
                html.push(data.universes[i].errors);
                html.push('</td></tr>');
            }
            html.push('</tbody></table>');
            if (data.universes.length > 32) {
                $("#bridgeStatistics1").html(html1);
                $("#bridgeStatistics2").html(html.join(''));
            } else {
                $("#bridgeStatistics1").html(html.join(''));
                $("#bridgeStatistics2").html('');

            }

        } else {
            // data.status != OK
            $("#bridgeStatistics1").html('Bridge Data not avaiable -- ' + data.status);
            $("#bridgeStatistics2").html('');
        }
    }).fail(function () {
        $("#bridgeStatistics1").html('Failed to refresh Bridge Stats - Unknown Error');
        $("#bridgeStatistics2").html('');
    });
}

	function UpdateCurrentEntryPlaying(index,lastIndex)
	{
		$('#tblPlaylistDetails tr').removeClass('PlaylistRowPlaying');
		$('#tblPlaylistDetails td').removeClass('PlaylistPlayingIcon');

		if((index >= 0) && ($('#playlistRow' + index).length))
		{
			$("#colEntryNumber" + index).addClass("PlaylistPlayingIcon");
			$("#playlistRow" + index).addClass("PlaylistRowPlaying");
		}
	}

	function SetIconForCurrentPlayingEntry(index)
	{
	}


	function StopGracefully()
	{
        var url = 'api/playlists/stopgracefully';
        $.get(url)
            .done(function() {})
            .fail(function() {});
	}

	function StopGracefullyAfterLoop()
	{
        var url = 'api/playlists/stopgracefullyafterloop';
        $.get(url)
            .done(function() {})
            .fail(function() {});
	}

	function StopNow()
	{
        var url = 'api/playlists/stop';
        $.get(url)
            .done(function() {})
            .fail(function() {});
	}

	function ToggleSequencePause()
	{
		var url = 'api/sequence/current/togglePause';

        $.get(url
        ).done(function() {
            $.jGrowl("Pause/Resume" ,{themeState:'success'});
        }).fail(function() {
            DialogError("Failed to Pause / Resume", "Start failed");
        });
    
	}

	function SingleStepSequence()
	{
		var url = 'api/sequence/current/step';

        $.get(url
        ).done(function() {
            $.jGrowl("Sequence Step" ,{themeState:'success'});
        }).fail(function() {
            DialogError("Failed Step Current Sequence", "Step failed");
        });
    
	}

	function SingleStepSequenceBack()
	{
        var url = 'api/sequence/current/stepBack';
        $.get(url
            ).done(function() {
                $.jGrowl("Sequence StepBack" ,{themeState:'success'});
            }).fail(function() {
                DialogError("Failed Step Current Sequence Back", "Step failed");
            });
        }

	function StopFPPD()
	{
    	var xmlhttp=new XMLHttpRequest();
			var url = "fppxml.php?command=stopFPPD";
			xmlhttp.open("GET",url,true);
			xmlhttp.setRequestHeader('Content-Type', 'text/xml');
			xmlhttp.send();
	}

	function SetSettingRestart(key, value) {
		var restartFPPD = 1;

		if ((key == 'LogLevel') ||
			(key == 'LogMask'))
		{
			restartFPPD = 0;
		}

		SetSetting(key, value, restartFPPD, 0);
	}

	function SetSettingReboot(key, value) {
		SetSetting(key, value, 0, 1);
	}

function SetSetting(key, value, restart, reboot) {
    //console.log("api/settings/", key);
    $.ajax({
        url: "api/settings/" + key,
        data: "" + value,
        method: "PUT",
        timeout: 1000,
        async: false,
        success: function() {
            if ((key != 'restartFlag') && (key != 'rebootFlag'))
                $.jGrowl(key + " setting saved.",{themeState:'success'});

            if (restart > 0 && restart != settings['restartFlag']) {
                SetRestartFlag(restart);
            }
            if (reboot > 0 && reboot != settings['rebootFlag']) {
                SetRebootFlag(restart);
            }
            CheckRestartRebootFlags();
        }
    }).fail(function() {
        DialogError('Save Setting', "Failed to save " + key + " setting.");
        CheckRestartRebootFlags();
    });
}

function SetPluginSetting(plugin, key, value, restart, reboot) {
    $.ajax({
        url: "fppjson.php?command=setPluginSetting&plugin=" + plugin + "&key=" + key + "&value=" + encodeURIComponent(value),
        timeout: 1000,
        async: false,
        success: function() {
            if ((key != 'restartFlag') && (key != 'rebootFlag'))
                $.jGrowl(key + " setting saved.",{themeState:'success'});

            if (restart > 0 && restart != settings['restartFlag']) {
                SetRestartFlag(restart);
            }
            if (reboot > 0 && reboot != settings['rebootFlag']) {
                SetRebootFlag(restart);
            }
            CheckRestartRebootFlags();
        }
    }).fail(function() {
        DialogError('Save Setting', "Failed to save " + key + " setting.");
        CheckRestartRebootFlags();
    });
}

function ReloadSettingOptions(settingName) {
    $.get('settings.json', function(sdata) {
        $.get(sdata.settings[settingName].optionsURL, function(data) {
            var options = "";
            if (typeof data != 'object') {
                for (var i = 0; i < data.length; i++) {
                    options += "<option value='" + data[i] + "'";

                    if ((settings.hasOwnProperty(settingName)) &&
                        (settings[settingName] == data[i]))
                        options += " selected";

                    options += ">" + data[i] + "</option>";
                }
            } else {
                var keys = Object.keys(data);
                for (var i = 0; i < keys.length; i++) {
                    options += "<option value='" + data[keys[i]] + "'";

                    if ((settings.hasOwnProperty(settingName)) &&
                        (settings[settingName] == data[keys[i]]))
                        options += " selected";

                    options += ">" + keys[i] + "</option>";
                }
            }

            $('#' + settingName).html(options);
            // if the current setting doesn't match any value in the new list,
            // then invoke the change so the currently displayed value is
            // the actual correct value
            if ($('#' + settingName).val() != settings[settingName]) {
                $('#' + settingName).trigger('change');
                settings[settingName] = $('#' + settingName).val();
            }
        });
    });
}

	function ClearRestartFlag() {
		settings['restartFlag'] = 0;
		SetSetting('restartFlag', 0, 0, 0);
	}

	function SetRestartFlag(newValue) {
		// 0 - no restart needed
		// 1 - full restart is needed
		// 2 - quick restart is OK
		if ((newValue == 2) &&
			(settings['restartFlag'] == 1))
			return;

		settings['restartFlag'] = newValue;
		SetSettingRestart('restartFlag', newValue);
	}

	function ClearRebootFlag() {
		settings['rebootFlag'] = 0;
		SetSetting('rebootFlag', 0, 0, 0);
	}

	function SetRebootFlag() {
		settings['rebootFlag'] = 1;
		SetSettingReboot('rebootFlag', 1);
	}

	function CheckRestartRebootFlags() {
		if (settings['disableUIWarnings'] == 1)
		{
			$('#restartFlag').hide();
			$('#rebootFlag').hide();
			return;
		}

		if (settings['restartFlag'] >= 1)
			$('#restartFlag').show();
		else
			$('#restartFlag').hide();

		if (settings['rebootFlag'] == 1)
		{
			$('#restartFlag').hide();
			$('#rebootFlag').show();
		}
		else
		{
			$('#rebootFlag').hide();
		}
	}

function RestartFPPD() {
		var args = "";

		if (settings['restartFlag'] == 2)
			args = "&quick=1";

		$('html,body').css('cursor','wait');
		$.get("api/system/fppd/restart" + args
		).done(function() {
			$('html,body').css('cursor','auto');
			$.jGrowl('FPPD Restarted',{themeState:'success'});
			ClearRestartFlag();
		}).fail(function() {
			$('html,body').css('cursor','auto');

            //If fail, the FPP may have rebooted (eg.FPPD triggering a reboot due to disabling soundcard or activating Pi Pixel output
            //start polling and see if we can wait for the FPP to come back up
            //restartFlag will already be cleared, but to keep things simple, just call the original code
            retries = 0;
            retries_max = max_retries;//avg timeout is 10-20seconds, polling resolves after 6-10 polls
            //attempt to poll every second, AJAX block for the default browser timeout if host is unavail
            retry_poll_interval_arr['restartFPPD'] = setInterval(function () {
                poll_result = false;
                if (retries < retries_max) {
                    //console.log("Polling @ " + retries);
                    $.ajax({
                            url: "api/system/status",
                            timeout: 1000,
                            async: true,
                            success: function (data) {
                                if (("fppd" in data) && data.fppd == 'running') {
                                    poll_result = true;
                                    //FPP is up then
                                    clearInterval(retry_poll_interval_arr['restartFPPD']);
                                    //run original code for success
                                    $.jGrowl('FPPD Restarted',{themeState:'success'});
                                    ClearRestartFlag();
                                } else {
                                    retries++;
                                }
                            }
                    }).fail(
                        function () {
                            poll_result = false;
                            retries++;
                            //If on first try throw up a FPP is rebooting notification
                            if(retries === 1){
                                //Show FPP is rebooting notification for 10 seconds
                                $.jGrowl('FPP is rebooting..',{ life: 10000 ,themeState:'detract'});
                            }
                        }
                    );

                    // console.log("Polling Result " + poll_result);
                } else {
                    //run original code
                    clearInterval(retry_poll_interval_arr['restartFPPD']);
                    DialogError("Restart FPPD", "Error restarting FPPD");
                }
            }, 2000);
		});
	}

function zeroPad(num, places) {
	var zero = places - num.toString().length + 1;
	return Array(+(zero > 0 && zero)).join("0") + num;
}

function ControlFPPD() {
    var url = "api/system/fppd/";
    var btnVal = $("#btnDaemonControl").attr('value');

    if (btnVal == "Stop FPPD") {
        url = url + "stop";
    }
    else {
        url = url + "start";
    }

    $.get({
        url: url,
        data: "",
    }).done(function(data) {
        $.jGrowl("Completed " + btnVal,{themeState:'success'});
        IsFPPDrunning();
    }).fail(function() {
        DialogError("ERROR", "Error Settng fppMode to " + modeText);
    });

}

function PopulatePlaylists(sequencesAlso,options)
{
    var playlistOptionsText="";
    var onPlaylistArrayLoaded=function(){}
    if(options){
        if(typeof options.onPlaylistArrayLoaded==='function'){
            onPlaylistArrayLoaded=options.onPlaylistArrayLoaded;
        }
    }
    GetPlaylistArray(onPlaylistArrayLoaded);

    if (sequencesAlso)
        playlistOptionsText += "<option disabled>---------- Playlists ---------- </option>";

    for(j = 0; j < playListArray.length; j++)
    {
        playlistOptionsText +=  "<option value=\"" + playListArray[j] + "\">" + playListArray[j] + "</option>";
    }

    if (sequencesAlso) {
        GetSequenceArray();

        playlistOptionsText += "<option disabled>---------- Sequences ---------- </option>";
        for(j = 0; j < sequenceArray.length; j++)
        {
            playlistOptionsText +=  "<option value=\"" + sequenceArray[j] + ".fseq\">" + sequenceArray[j] + ".fseq</option>";
        }
    }

    $('#playlistSelect').html(playlistOptionsText);
}

function PlayPlaylist(Playlist, goToStatus = 0)
{
    $.get("api/command/Start Playlist/" + Playlist + "/0", function() {
        if (goToStatus)
	        location.href="index.php";
        else
            $.jGrowl("Playlist Started",{themeState:'success'});
    });
}

function StartPlaylistNow() {
    var Playlist = $("#playlistSelect").val();
    var repeat = $("#chkRepeat").is(':checked') ? true : false;
    var obj = {
        command: "Start Playlist At Item",
        args: [
            Playlist,
            PlayEntrySelected,
            repeat,
            false
        ]
    }
    $.post("api/command", JSON.stringify(obj)
    ).done(function () {
        $.jGrowl("Playlist Started", {themeState:'success'});
    }).fail(function () {
        DialogError('Command failed', 'Unable to start Playlist');
    });
}

function StopEffect() {
    if (RunningEffectSelectedId < 0)
        return;

    var msg = {
        "command": "Effect Stop",
        "args": [
            RunningEffectSelectedName
        ]
    };

    $.post({
        url: "api/command",
        data: JSON.stringify(msg)
    }).done(function (data) {
        RunningEffectSelectedId = -1;
        RunningEffectSelectedName = "";
        GetRunningEffects();
    }).fail(function () {
        DialogError('Command failed', 'Call to Stop Effect Failed');
        GetRunningEffects();
    });
}

var lastRunningEffectsData = null;

function GetRunningEffects() {
    $.get("api/fppd/effects"
    ).done(function (data) {

        if ("runningEffects" in data) {
            var isFreshData = !lastRunningEffectsData || JSON.stringify(lastRunningEffectsData)!=JSON.stringify(data.runningEffects);
            if(data.runningEffects.length>0){
                if(isFreshData){
                    $('#tblRunningEffectsBody').html('');
                    data.runningEffects.forEach(function (e) {
                        if (e.name == RunningEffectSelectedName)
                            {$('#tblRunningEffectsBody').append('<tr class="effectSelectedEntry"><td width="5%">' + e.id + '</td><td width="80%">' + e.name + '</td><td width="15%"><button class="buttons btn-danger">Stop</button></td></tr>');}
                        else
                            {$('#tblRunningEffectsBody').append('<tr><td width="5%">' + e.id + '</td><td width="80%">' + e.name + '</td><td width="15%"><button class="buttons btn-danger">Stop</button></td></tr>');}
                        $('#divRunningEffects').removeClass('divRunningEffectsDisabled backdrop-disabled').addClass('divRunningEffectsRunning backdrop-success');
                    });
                    lastRunningEffectsData=data.runningEffects
                }
            }else{
                lastRunningEffectsData = null;
                $('#divRunningEffects').addClass('divRunningEffectsDisabled backdrop-disabled').removeClass('divRunningEffectsRunning backdrop-success');
            }            
        } else {
            lastRunningEffectsData = null;
            $('#divRunningEffects').addClass('divRunningEffectsDisabled backdrop-disabled').removeClass('divRunningEffectsRunning backdrop-success');
        }
        setTimeout(GetRunningEffects, 1000);
    }).fail(function () {
        DialogError('Query Failed', 'Failed to refresh running effects.');
        GetRunningEffects();
    });
}

	function RebootPi()
	{
		if (confirm('REBOOT the Falcon Player?'))
		{
			ClearRestartFlag();
			ClearRebootFlag();

			//Delay reboot for 1 second to allow flags to be cleared
            setTimeout(function () {
                $.get({
                    url: "api/system/reboot",
                    data: "",
                    success: function(data) {
                        //Show FPP is rebooting notification for 60 seconds then reload the page
                        $.jGrowl('FPP is rebooting..', {life: 60000, themeState:'detract'});
                        setTimeout(function () {
                                location.href="index.php";
                        }, 60000);
                    },
                    error: function() {
                        DialogError('Command failed', 'Command failed');
                    }

                });
            }, 1000);
		}
	}

	function ShutdownPi()
	{
		if (confirm('SHUTDOWN the Falcon Player?'))
		{
            $.get({
                url: "api/system/shutdown",
                data: "",
                success: function(data) {
                    //Show FPP is rebooting notification for 60 seconds then reload the page
                    $.jGrowl('FPP is shutting down..', {life: 60000,themeState:'detract'});
                },
                error: function() {
                    DialogError('Command failed', 'Command failed');
                }

            });
		}
	}

function UpgradePlaylist(data, editMode)
{
    var sections = ['leadIn', 'mainPlaylist', 'leadOut'];
    var events = GetSync('api/events');
    var error = "";

    for (var s = 0; s < sections.length; s++) {
        if (typeof data[sections[s]] != 'object') {
            continue;
        }

        for (i = 0; i < data[sections[s]].length; i++) {
            var type = data[sections[s]][i]['type'];
            var o = data[sections[s]][i];
            var n = {};

            n.enabled = o.enabled;
            n.playOnce = o.playOnce;

            // Changes for both Status UI and Edit Mode.  These are needed in the status UI
            // when new fields replace old fields and where the PlaylistEntry* classes also
            // handle these conversions.
            if (type == 'branch') {
                if (((typeof o.startTime === 'undefined') ||
                     (typeof o.endTime === 'undefined')) &&
                    (typeof o.compInfo != 'undefined')) {
                    n = o;
                    n.startTime =
                        PadLeft(o.compInfo.startHour, '0', 2) + ':' +
                        PadLeft(o.compInfo.startMinute, '0', 2) + ':' +
                        PadLeft(o.compInfo.startSecond, '0', 2);

                    n.endTime =
                        PadLeft(o.compInfo.endHour, '0', 2) + ':' +
                        PadLeft(o.compInfo.endMinute, '0', 2) + ':' +
                        PadLeft(o.compInfo.endSecond, '0', 2);

                    delete n.compInfo;
                    data[sections[s]][i] = n;
                }

                if (typeof o.branchType != 'undefined') {
                    n = o;
                    n.branchTest = n.branchType;
                    delete n.branchType;
                    data[sections[s]][i] = n;
                }
            } else if (type == 'dynamic') {
                if ((o.subType == 'file') &&
                    (typeof o.dataFile != 'string') &&
                    (typeof o.data == 'string')) {
                    n = o;
                    n.dataFile = n.data;
                    data[sections[s]][i] = n;
                } else if ((o.subType == 'plugin') &&
                    (typeof o.pluginName != 'string') &&
                    (typeof o.data == 'string')) {
                    n = o;
                    n.pluginName = n.data;
                    data[sections[s]][i] = n;
                } else if ((o.subType == 'url') &&
                    (typeof o.url != 'string') &&
                    (typeof o.data == 'string')) {
                    n = o;
                    n.url = n.data;
                    data[sections[s]][i] = n;
                }
            }

            // Changes needed only during edit mode when we are upgrading a playlist
            if (editMode) {
                if (type == 'event') {
                    var id = PadLeft(o.majorID, '0', 2) + '_' + PadLeft(o.minorID, '0', 2);
                    if (typeof events[id] === 'object') {
                        n.type = 'command';
                        n.command = events[id].command;
                        n.args = events[id].args;

                        data[sections[s]][i] = n;
                    } else {
                        DialogError("Converting deprecated Event", "The Event playlist entry type has been deprecated.  FPP tries to automatically convert these to the new FPP Command playlist entry type, but the specified event ID '" + id + "' could not be found.  The existing playlist on-disk will not be modified, but the deprecated Event has been removed from the playlist editor.");
                    }
                } else if (type == 'mqtt') {
                    n.type = 'command';
                    n.command = "MQTT";

                    var args = [];
                    args.push(o.topic);
                    args.push(o.message);

                    n.args = args;

                    data[sections[s]][i] = n;
// 'Run Script' command does not support blocking yet. If this
// is done, then PlaylistEntryScript.cpp can be deprecated.
//                } else if (type == 'script') {
//                    n.type = 'command';
//                    n.command = 'Run Script';
//
//                    var args = [];
//                    args.push(o.scriptName);
//                    args.push(o.scriptArgs);
//
//                    n.args = args;
//
//                    data[sections[s]][i] = n;
                } else if (type == 'volume') {
                    n.type = 'command';
                    n.command = 'Volume Adjust';
                    n.args = [ o.volume ];

                    data[sections[s]][i] = n;
                } else if ((type == 'command') &&
                           (o.command == 'Overlay Model Text')) {
                    n = o;
                    n.command = 'Overlay Model Effect';
                    n.multisyncCommand = false;

                    var args = [];
                    args.push(o.args[0]);
                    args.push("Enabled");
                    args.push("Text");
                    args.push(o.args[1]);
                    args.push(o.args[2]);
                    args.push(o.args[3]);
                    args.push(o.args[4]);
                    args.push(o.args[5]);
                    args.push(o.args[6]);
                    args.push("0");
                    args.push(o.args[8]);

                    n.args = args;

                    data[sections[s]][i] = n;
                }
            }
        }
    }

    return data;
}

function PopulatePlaylistDetails(data, editMode, name = "")
{
    var innerHTML = "";
    var entries = 0;
    data = UpgradePlaylist(data, editMode);

    if (!editMode)
        $('#deprecationWarning').hide(); // will re-show if we find any

    var sections = ['leadIn', 'mainPlaylist', 'leadOut'];
    for (var s = 0; s < sections.length; s++) {
        var idPart = sections[s].charAt(0).toUpperCase() + sections[s].slice(1);

        if (data.hasOwnProperty(sections[s]) && data[sections[s]].length > 0)
        {
            innerHTML = "";
            for (i = 0; i < data[sections[s]].length; i++)
            {
                innerHTML += GetPlaylistRowHTML(entries, data[sections[s]][i], editMode);
                entries++;
            }
            $('#tblPlaylist' + idPart).html(innerHTML);
            $('#tblPlaylist' + idPart + 'Header').show().parent().addClass('tblPlaylistActive');

            if (!data[sections[s]].length)
                $('#tblPlaylist' + idPart).html("<tr id='tblPlaylist" + idPart + "PlaceHolder' class='unselectable'><td>&nbsp;</td></tr>");

            $('#tblPlaylist' + idPart + ' > tr').each(function() {
                PopulatePlaylistItemDuration($(this), editMode);
            });
        }
        else
        {
            $('#tblPlaylist' + idPart).html("");
            if (editMode) {
                $('#tblPlaylist' + idPart + 'Header').show().parent().addClass('tblPlaylistActive');
                $('#tblPlaylist' + idPart).html("<tr id='tblPlaylist" + idPart + "PlaceHolder' class='unselectable'><td>&nbsp;</td></tr>");
            } else {
                $('#tblPlaylist' + idPart + 'Header').hide().parent().removeClass('tblPlaylistActive');;
            }
        }
    }

    if (!editMode) {
        gblCurrentLoadedPlaylist = data.name;
        gblCurrentLoadedPlaylistCount = entries;
        UpdatePlaylistDurations();
    }
    var desc = "";
    if (data.hasOwnProperty('desc')) {
        desc = data.desc
    }
    $("#txtPlaylistDesc").val(desc)
    if (name == "") {
        SetPlaylistName(data.name);
    } else {
        SetPlaylistName(name);
    }
    if (editMode) {
        if (typeof data.random === "undefined") {
            $('#randomizePlaylist').val(0);
        } else {
            $('#randomizePlaylist').val(data.random);
        }
    } else {
        if (typeof data.random === "undefined") {
            $('#txtRandomize').html('Off');
        } else {
            if (data.random == 0)
                $('#txtRandomize').html('Off');
            else if (data.random == 1)
                $('#txtRandomize').html('Once at load time');
            else if (data.random == 2)
                $('#txtRandomize').html('Once per iteration');
            else
                $('#txtRandomize').html('Invalid value');
        }
    }
}

function PopulatePlaylistDetailsEntries(playselected,playList)
{
    var pl;
    var fromMemory = "";
    var url = "";

    if (playselected == true)
    {
        pl = $('#playlistSelect :selected').text();
        url = "api/playlist/" + pl + '?mergeSubs=1';
    }
    else
    {
        pl = playList;
        url = "api/fppd/playlist/config/"; // In Memory URL
    }

    PlayEntrySelected = 0;
    PlaySectionSelected = '';

    $.ajax({
        url: url,
        dataType: 'json',
        success: function(data, reqStatus, xhr) {
            PopulatePlaylistDetails(data, 0, pl);
            VerbosePlaylistItemDetailsToggled();
        }
    });
}

function SelectPlaylistDetailsEntryRow(index)
{
		PlayEntrySelected  = index;
}

function SetVolume(value) {
    var obj = {
        volume: value
    };
    $.post({
        url: "api/system/volume",
        data: JSON.stringify(obj)
    }
    ).done(function (data) {
        // Nothing
    }).fail(function () {
        DialogError("ERROR", "Failed to set volume to " + value);
    })
}

function SetFPPDmode(modeText)
{
    //var mode = $('#selFPPDmode').val();
    // var modeText = "unknown"; // 0
    // if (mode == 1) {
    //     modeText = "bridge";
    // } else if (mode == 2) {
    //     modeText = "player";
    // } else if (mode ==6) {
    //     modeText = "master";
    // } else if (mode == 8) {
    //     modeText = "remote";
    // }

    $.ajax({
        url: "api/settings/fppMode",
        type: 'PUT',
        data: modeText
    }).done(function(data) {
		$.jGrowl("fppMode Saved",{themeState:'success'});
		RestartFPPD();
    }).fail(function() {
        DialogError("ERROR", "Error Settng fppMode to " + modeText);
    });
}

function AdjustFPPDModeFromStatus(mode) {
    var cur = $("#selFPPDmode").val();
    SetupUIForMode(mode);
    if (mode != cur) {
        if(mode == 1) // Bridge Mode
        {
            $("#selFPPDmode").prop("selectedIndex",3);
            $("#textFPPDmode").text("Bridge");
        } else if (mode == 8) { // Remote Mode
            $("#selFPPDmode").prop("selectedIndex",2);
            $("#textFPPDmode").text("Player (Remote)");
        } else { // Player or Master modes
            if (mode == 2) { // Player
                $("#selFPPDmode").prop("selectedIndex",0);
                $("#textFPPDmode").text("Player (Standalone)");
            } else {
                $("#selFPPDmode").prop("selectedIndex",1);
                $("#textFPPDmode").text("Player (Master)");
            }
        }
    }
}

function GetFPPDmode()
{
    $.get("api/settings/fppMode"
         ).done(function(data) {
            if ("value" in data) {
                var mode = 0;
                if (data.value == "bridge") {
                    mode = 1;
                } else if (data.value == "player") {
                    mode = 2;
                } else if (data.value == "master") {
                    mode = 4;
                } else if (data.value == "remote") {
                    mode = 8;
                }
                SetupUIForMode(mode);
                if(mode == 1) // Bridge Mode
                {
                    $("#selFPPDmode").prop("selectedIndex",3);
                    $("#textFPPDmode").text("Bridge");
                } else if (mode == 8) { // Remote Mode
                    $("#selFPPDmode").prop("selectedIndex",2);
                    $("#textFPPDmode").text("Player (Remote)");
                } else { // Player or Master modes
                    if (mode == 2) { // Player
                        $("#selFPPDmode").prop("selectedIndex",0);
                        $("#textFPPDmode").text("Player (Standalone)");
                    } else {
                        $("#selFPPDmode").prop("selectedIndex",1);
                        $("#textFPPDmode").text("Player (Master)");
                    }
                }
            } else {
                DialogError("Invalid Mode", "Mode API returned unexpected value");
            }
    }).fail(function(data){
		DialogError("Failed to query Settings", "Could not load mode");
    });
}

var helpOpen = 0;
function HelpClosed() {
    helpOpen = 0;
}

function DisplayHelp()
{
    if (helpOpen) {
        helpOpen = 0;
        $('#dialog-help').fppDialog('close');
        return;
    }

    var tmpHelpPage = helpPage;

	if ((helpPage == 'help/settings.php') && $('#tabs').length) {
		var tab = $("#tabs li.ui-tabs-active a").attr('href').replace('#tab-', '');
        if (tab != '') {
            tmpHelpPage = "help/" + tab;
        }
	}

	$('#helpText').html("No help file exists for this page yet.  Check the <a href='https://falconchristmas.github.io/FPP_Manual(4.6).pdf' target='_blank'>FPP Manual</a> for more info.");
	$('#helpText').load(tmpHelpPage);
	$('#dialog-help').fppDialog({ width: 1000, title: "Help - Hit F1 or ESC to close", close: HelpClosed });
	$('#dialog-help').fppDialog( "moveToTop" );
    helpOpen = 1;
}

function GetGitOriginLog()
{
    $('#logText').html('Loading list of changes from github. <div class="ajax-loading-60px"></div>');
	$('#logViewer').fppDialog({ height: 600, width: 800, title: "Git Changes" });
	$('#logViewer').fppDialog( "moveToTop" );
    $.get({
        url: "api/git/originLog",
        data: "",
        success: function(data) {
            if ("rows" in data) {
                html = [];
                html.push("<table>")
                data.rows.forEach(function(r) {
                    html.push('<tr><td><a href="https://github.com/FalconChristmas/fpp/commit/');
                    html.push(r.hash);
                    html.push('">');
                    html.push(r.hash.substring(0,8));
                    html.push('</a></td><td>');
                    html.push(r.msg);
                    html.push('</td></tr>');
                });
                html.push('</table>');
                $('#logText').html(html.join(''));
            }
        }
    });
}

function GetVideoInfo(file)
{
    $('#fileText').html("Getting Video Info.");

    $.get("api/media/" + file + "/meta", function(data) {
        $('#fileText').html('<pre>' + syntaxHighlight(JSON.stringify(data, null, 2)) + '</pre>');
        $('#fileViewer').fppDialog({ height: 600, width: 800, title: "Video Info" });
        $('#fileViewer').fppDialog( "moveToTop" );
    });
}

function PlayFileInBrowser(dir, file)
{
	window.open("api/file/" + dir + "/" + encodeURIComponent(file) + "?play=1");
}

function CopyFile(dir, file)
{
	var newFile = prompt("New Filename:", file);
    var url = "api/file/" + dir + "/copy/" + file + "/" + newFile;

	$.post(url, "").done(function(data) {
		if (data.status == 'success')
			GetFiles(dir);
		else
			DialogError("File Copy Failed", "Error: File Copy failed.");
	}).fail(function() {
		DialogError("File Copy Failed", "Error: File Copy failed.");
	});
}

function RenameFile(dir, file)
{
	var newFile = prompt("New Filename:", file);
    var url = "api/file/" + dir + "/rename/" + file + "/" + newFile;

	$.post(url, "").done(function(data) {
		if (data.status == 'success')
			GetFiles(dir);
		else
			DialogError("File Rename Failed", "Error: File Rename failed.");
	}).fail(function() {
		DialogError("File Rename Failed", "Error: File Rename failed.");
	});
}

function DownloadFile(dir, file)
{
	location.href="api/file/" + dir + "/" + encodeURIComponent(file);
}

function DownloadFiles(dir, files)
{
    if (files.length == 1) {
        DownloadFile(dir, files[0]);
    } else {
        for (var i = 0; i < files.length; i++) {
            window.open("api/file/" + dir + "/" + encodeURIComponent(files[i]));
        }
    }
}

function DownloadZip(dir)
{
	location.href="api/files/zip/" + dir;
}

function ViewImage(file)
{
	var url = "api/file/Images/" + encodeURIComponent(file);
	window.open(url, '_blank');
}

function ViewFile(dir, file){
	var url = "api/file/" + dir + "/" + encodeURIComponent(file);
	ViewFileImpl(url, file);
}
function TailFile(dir, file, lines) {
    var url = "api/file/" + dir + "/" + encodeURIComponent(file) + "?tail=" + lines;
    //console.log(url);
	ViewFileImpl(url, file);
}
function ViewFileImpl(url, file)
{
	$('#fileText').html("Loading...");
	$.get(url, function(text) {
		var ext = file.split('.').pop();
		if (ext != "html")
			$('#fileText').html("<pre>" + text.replace(/</g, '&lt;').replace(/>/g, '&gt;') + "</pre>");
	});

	$('#fileViewer').fppDialog({  width: 1800, title: "File Viewer: " + file, height:'100%', resizable:true,overflowX:'scroll' });
	$('#fileViewer').fppDialog( "moveToTop" );
}

function DeleteFile(dir, row, file)
{
	if (file.indexOf("/") > -1)
	{
		alert("You can not delete this file.");
		return;
	}

    $.ajax({
        url: "api/file/" + dir + "/" + encodeURIComponent(file),
        type: 'DELETE'
    }).done(function(data) {
        if (data.status == "OK") {
            $(row).remove();
        } else {
            DialogError("ERROR", "Error deleting file \"" + file + "\": " + data.status);
        }
    }).fail(function() {
        DialogError("ERROR", "Error deleting file: " + file);
    });
}

function SetupSelectableTableRow(info)
{
	$('#' + info.tableName + ' > tbody').on('mousedown', 'tr', function(event,ui){
		$('#' + info.tableName + ' > tbody > tr').removeClass('fppTableSelectedEntry');
		$(this).addClass('fppTableSelectedEntry');
		var items = $('#' + info.tableName + ' > tbody > tr');
		info.selected  = items.index(this);

		for (var i = 0; i < info.enableButtons.length; i++) {
			SetButtonState('#' + info.enableButtons[i], "enable");
		}
		for (var i = 0; i < info.disableButtons.length; i++) {
			SetButtonState('#' + info.disableButtons[i], "disable");
		}
	});

    if (info.hasOwnProperty('sortable') && info.sortable && (window.innerWidth > 600)) {
        $('#' + info.tableName + ' > tbody').sortable({
            update: function(event, ui) {
                if ((info.hasOwnProperty('sortableCallback')) &&
                    (info.sortableCallback != '')) {
                    window[info.sortableCallback]();
                }
            },
            scroll: true
        }).disableSelection();
    }
}

function DialogOK(title, message)
{
	$('#dialog-popup').fppDialog({
	
        content:message,
        title:title,
		width: 400,
		autoResize: true,
		closeOnEscape: false,
		buttons: {
			Ok: function() {
				$(this).fppDialog("close");
			}
		}
	});


}

// Simple wrapper for now, but we may highlight this somehow later
function DialogError(title, message)
{
	DialogOK(title, message);
}

// page visibility prefixing
function getHiddenProp(){
    var prefixes = ['webkit','moz','ms','o'];

    // if 'hidden' is natively supported just return it
    if ('hidden' in document) return 'hidden';

    // otherwise loop over all the known prefixes until we find one
    for (var i = 0; i < prefixes.length; i++){
        if ((prefixes[i] + 'Hidden') in document)
            return prefixes[i] + 'Hidden';
    }

    // otherwise it's not supported
    return null;
}

// return page visibility
function isHidden() {
    var prop = getHiddenProp();
    if (!prop) return false;

    return document[prop];
}

function bindVisibilityListener() {
	var visProp = getHiddenProp();
	if (visProp) {
	  var evtname = visProp.replace(/[H|h]idden/,'') + 'visibilitychange';
	  document.addEventListener(evtname, handleVisibilityChange);
	}
}

function handleVisibilityChange() {
    if (isHidden() && statusTimeout != null) {
        clearTimeout(statusTimeout);
        statusTimeout = null;
    } else {
        LoadSystemStatus();
        //GetFPPStatus();
    }
}

// syntaxHighlight() from https://stackoverflow.com/questions/4810841/pretty-print-json-using-javascript
function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\\\u[a-zA-Z0-9]{4}|\\\\[^u]|[^\\\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'jsNumber';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'jsKey';
            } else {
                cls = 'jsString';
            }
        } else if (/true|false/.test(match)) {
            cls = 'jsBoolean';
        } else if (/null/.test(match)) {
            cls = 'jsNull';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

function CommandToJSON(commandSelect, tblCommand, json, addArgTypes = false) {
    var args = new Array()
    var argTypes = new Array()
    var commandVal = $('#' + commandSelect).val();;
    json['command'] = commandVal;
    if (commandVal != "" && !(typeof commandVal == "undefined")) {
        json['multisyncCommand'] = $("#" + tblCommand + "_multisync").is(":checked");
        json['multisyncHosts'] = $("#" + tblCommand + "_multisyncHosts").val();
        for (var x = 1; x < 20; x++) {
            var inp =  $("#" + tblCommand + "_arg_" + x);
            var val = inp.val();
            if (inp.attr('type') == 'checkbox') {
                if (inp.is(":checked")) {
                    args.push("true");
                } else {
                    args.push("false");
                }
                if (addArgTypes) {
                    argTypes.push(inp.data("arg-type"));
                }
            } else if (inp.attr('type') == 'number' || inp.attr('type') == 'text') {
                args.push(val);
                var adj =  $("#" + tblCommand + "_arg_" + x + "_adjustable");
                if (adj.attr('type') == "checkbox") {
                    if (adj.is(":checked")) {
                        if (typeof json['adjustable'] == "undefined") {
                            json['adjustable'] = {};
                        }
                        json['adjustable'][x] = inp.attr('type');
                    } else {
                        if (typeof json['adjustable'] != "undefined") {
                            delete json['adjustable'][x];
                            if (jQuery.isEmptyObject(json['adjustable'])) {
                                delete json['adjustable'];
                            }
                        }
                    }
                }
                if (addArgTypes) {
                    argTypes.push(inp.data("arg-type"));
                }
            } else if (Array.isArray(val)) {
                args.push(val.toString());
                if (addArgTypes) {
                    argTypes.push(inp.data("arg-type"));
                }
            } else if (typeof val != "undefined") {
                args.push(val);
                if (addArgTypes) {
                    argTypes.push(inp.data("arg-type"));
                }
            }
        }
    }
    json['args'] = args;
    if (addArgTypes) {
        json['argTypes'] = argTypes;
    }
    return json;
}

function LoadCommandArg() {
    LoadCommandList($('.arg_command'));
}

var commandList = "";
var commandListByName = {};
var extraCommands = "";
function PopulateCommandListCache() {
    if (typeof commandList != "string")
        return;

    $.ajax({
        dataType: "json",
        url: "api/commands",
        async: false,
        success: function(data) {
           commandList = data;
           if (extraCommands != "") {
                $.each( extraCommands, function(key, val) {
                    commandList.push(val);
                });
           }

           $.each( commandList, function(key, val) {
               commandListByName[val['name']] = val;
           });
        }});
}

function LoadCommandList(commandSelect) {
    if (typeof commandSelect === "string") {
        commandSelect = $('#' + commandSelect);
    }
    if (commandList == "") {
        PopulateCommandListCache();
    }

    $.each( commandList, function(key, val) {
        option = "<option value='" + val['name'] + "'>" + val['name'] + "</option>";
        commandSelect.append(option);
    });
}

function UpdateChildVisibility() {
    if (typeof playlistEntryTypes === "undefined") {
        return;
    }
    var pet = playlistEntryTypes[$('#pe_type').val()];
    var keys = Object.keys(pet.args);
    var shown = [];

    for (var i = 0; i < keys.length; i++) {
        var a = pet.args[keys[i]];
        if (typeof a['children'] === 'object') {
            var val = $('.arg_' + a.name).val();
            var ckeys = Object.keys(a.children);
            for (var c = 0; c < ckeys.length; c++) {
                for (var x = 0; x < a.children[ckeys[c]].length; x++) {
                    if (val == ckeys[c]) {
                        if ($('.arg_row_' + a.name).is(":visible")) {
                            $('.arg_row_' + a.children[ckeys[c]][x]).show();
                            shown.push(a.children[ckeys[c]][x]);
                        } else {
                            $('.arg_row_' + a.children[ckeys[c]][x]).hide();
                        }
                    } else {
                        if (!shown.includes(a.children[ckeys[c]][x])) {
                            $('.arg_row_' + a.children[ckeys[c]][x]).hide();
                        }
                    }
                }
            }
        }
    }
}

function CommandArgChanged() {
    $('#playlistEntryCommandOptions').html('');
    CommandSelectChanged('playlistEntryOptions_arg_1', 'playlistEntryCommandOptions');
}

var allowMultisyncCommands = false;
function OnMultisyncChanged(mscheck, tblCommand) {
    var b = $(mscheck).is(":checked");
    if (b) {
        $("#" + tblCommand + "_multisyncHosts_row").show();
    } else {
        $("#" + tblCommand + "_multisyncHosts_row").hide();
    }
}

var remoteIpList = null;
function GetRemotes() {
    if (remoteIpList == null) {
        $.ajax({
        dataType: "json",
        async: false,
        url: "api/remotes",
        success: function(data) {
               remoteIpList = data;
             }
         });
    }
    return remoteIpList;
}
function CommandSelectChanged(commandSelect, tblCommand, configAdjustable = false, argPrintFunc = PrintArgInputs)
{
    for (var x = 1; x < 25; x++) {
        $('#' + tblCommand + '_arg_' + x + '_row').remove();
        $("#" + tblCommand + "_multisync_row").remove();
        $("#" + tblCommand + "_multisyncHosts_row").remove();
    }
    var command = $('#' + commandSelect).val();
    if (typeof command == "undefined"  ||  command == null) {
        return;
    }
    var co = commandList.find(function(element) {
                              return element["name"] == command;
                              });
   if (typeof co == "undefined"  ||  co == null) {
       $.ajax({
       dataType: "json",
       async: false,
       url: "api/commands/" + command,
       success: function(data) {
              co = data;
            }
        });
   }
    var line = "<tr id='" + tblCommand + "_multisync_row' ";
    if (!allowMultisyncCommands || command == "") {
        line += "style='display:none'";
    }
    line += "><td>Multicast:</td><td><input type='checkbox' id='" + tblCommand
        + "_multisync' onChange='OnMultisyncChanged(this, \"" +  tblCommand + "\");'></input></td></tr>";
    $('#' + tblCommand).append(line);
    line = "<tr id='" + tblCommand + "_multisyncHosts_row' style='display:none'><td>Hosts:</td><td><input style='width:100%;' type='text' id='" + tblCommand + "_multisyncHosts'";
    line += " list='" + tblCommand + "_multisyncHosts_list'></input>";
    line += "<datalist id='"+ tblCommand + "_multisyncHosts_list'>";
    remotes = GetRemotes();
    $.each( remotes, function (k, v) {
           line += "<option value='" + k + "'>" + v + "</option>\n";
           });
    line += "</datalist></td></tr>";

    $('#' + tblCommand).append(line);

    argPrintFunc(tblCommand, configAdjustable, co['args']);

}
function SubCommandChanged(subCommandV, configAdjustable = false, argPrintFunc = PrintArgInputs) {
    var subCommand = $(subCommandV);
    if (typeof subCommandV === "string") {
        subCommand = $("#" + subCommandV);
    }
    var val = subCommand.val();
    var url = subCommand.data("url");
    if (url == null) {
        url = subCommand.data("contentlisturl");
    }
    var count = subCommand.data("count");
    var tblCommand = subCommand.data('tblcommand');

    for (var x = count+1; x < 25; x++) {
        $('#' + tblCommand + '_arg_' + x + '_row').remove();
    }
    $.ajax({
           dataType: "json",
           async: false,
           url: url + val,
           success: function(data) {
            argPrintFunc(tblCommand, false, data['args'], count+1);
           }
    });

}
function PrintArgsInputsForEditable(tblCommand, configAdjustable, args, startCount = 1) {
    var count = startCount;
    var initFuncs = [];
    var haveTime = 0;
    var haveDate = 0;
    var children = [];

//    $.each( args,
    var valFunc = function( key, val ) {
        if (val['type'] == 'args') {
            return;
        }

        if ((val.hasOwnProperty('statusOnly')) &&
            (val.statusOnly == true)) {
            return;
        }
        if ((val.hasOwnProperty('hidden')) &&
            (val.hidden == true)) {
            return;
        }
        var ID = tblCommand + "_arg_" + count;
        var line = "<tr id='" + ID + "_row' class='arg_row_" + val['name'] + "'><td>";
        var subCommandInitFunc = null;
        if (children.includes(val['name']))
            line += "&nbsp;&nbsp;&nbsp;&nbsp;&bull;&nbsp;";

        var typeName = val['type'];
        if (typeName == "datalist") {
            typeName = "string";
        }

        var dv = "";
        if (typeof val['default'] != "undefined") {
            dv = val['default'];
        }
        var contentListPostfix = "";
        if (val['type'] == "subcommand") {
            line += val["description"] + ":</td><td>";
            line += "<select class='playlistDetailsSelect arg_" + val['name'] + "' name='parent_" + val['name'] + "' id='" + ID + "'";
            line += " onChange='SubCommandChanged(this, " + configAdjustable + ", PrintArgsInputsForEditable)'";
            line += " data-url='" + val['contentListUrl'] + "'";
            line += " data-count='" + count + "'";
            line += " data-tblcommand='" + tblCommand + "'";
            line += " data-arg-type='subcommand'";
            line += ">";
            subCommandInitFunc = function () { SubCommandChanged(ID, configAdjustable, PrintArgsInputsForEditable);};
            $.each( val['contents'], function( key, v ) {
                   line += '<option value="' + v + '"';
                   if (v == dv) {
                        line += " selected";
                   }

                    if (Array.isArray(val['contents']))
                        line += ">" + v + "</option>";
                    else
                        line += ">" + key + "</option>";
             });
             line += "</select>";
        } else {
            line += val["description"] + " (" + typeName + "):</td><td>";
            line += "<input class='arg_" + val['name'] + "' id='" + ID  + "' type='text' size='40' maxlength='200' data-arg-type='" + typeName + "' ";
            if (val['type'] == "datalist" ||  (typeof val['contentListUrl'] != "undefined") || (typeof val['contents'] != "undefined")) {
                line += " list='" + ID + "_list' value='" + dv + "'";
            } else if (val['type'] == "bool") {
                if (dv == "true" || dv == "1") {
                    line += " value='true'";
                } else {
                    line += " value='false'";
                }
            } else if (val['type'] == "time") {
                line += " value='00:00:00'";
            } else if (val['type'] == "date") {
                line += " value='2020-12-25'";
            } else if ((val['type'] == "int") || (val['type'] == "float")) {
                if (dv != "") {
                    line += " value='" + dv + "'";
                } else if (typeof val['min'] != "undefined") {
                    line += " value='" + val['min'] + "'";
                }
            } else if (dv != "") {
                line += " value='" + dv + "'";
            }
            line += ">";
            if ((val['type'] == "int") || (val['type'] == "float")) {
                if (typeof val['unit'] === 'string') {
                    line += ' ' + val['unit'];
                }
            }
            line +="</input>";
            if (val['type'] == "datalist" || (typeof val['contentListUrl'] != "undefined") || (typeof val['contents'] != "undefined")) {
                line += "<datalist id='" + ID + "_list'>";
                $.each(val['contents'], function( key, v ) {
                       line += '<option value="' + v + '"';
                       line += ">" + v + "</option>";
                       });
                line += "</datalist>";
                contentListPostfix = "_list";
            }
        }

        line += "</td></tr>";
        $('#' + tblCommand).append(line);
        if (typeof val['contentListUrl'] != "undefined") {
            var selId = "#" + tblCommand + "_arg_" + count + contentListPostfix;
            $.ajax({
                   dataType: "json",
                   url: val['contentListUrl'],
                   async: false,
                   success: function(data) {
                       if (Array.isArray(data)) {
                            $.each( data, function( key, v ) {
                              var line = '<option value="' + v + '"';
                              if (v == dv) {
                                line += " selected";
                              }
                              line += ">" + v + "</option>";
                              $(selId).append(line);
                            });
                       } else {
                            $.each( data, function( key, v ) {
                                   var line = '<option value="' + key + '"';
                                   if (key == dv) {
                                        line += " selected";
                                   }
                                   line += ">" + v + "</option>";
                                   $(selId).append(line);
                            });
                       }
                   }
                   });
        }
        if (subCommandInitFunc != null) {
            subCommandInitFunc();
        }
        count = count + 1;
    };
    $.each( args, valFunc);
}

function PrintArgInputs(tblCommand, configAdjustable, args, startCount = 1) {
    var count = startCount;
    var initFuncs = [];
    var haveTime = 0;
    var haveDate = 0;
    var children = [];

    $.each( args, function( key, val ) {
         if (val['type'] == 'args')
            return;

         if ((val.hasOwnProperty('statusOnly')) &&
             (val.statusOnly == true)) {
            return;
         }
        if ((val.hasOwnProperty('hidden')) &&
            (val.hidden == true)) {
           return;
        }

         var ID = tblCommand + "_arg_" + count;
         var line = "<tr id='" + ID + "_row' class='arg_row_" + val['name'] + "'><td>";
         var subCommandInitFunc = null;

         if (children.includes(val['name']))
            line += "&nbsp;&nbsp;&nbsp;&nbsp;&bull;&nbsp;";

         line += val["description"] + ":</td><td>";

         var dv = "";
         if (typeof val['default'] != "undefined") {
            dv = val['default'];
         }
         var contentListPostfix = "";
         if ((val['type'] == "string") || (val['type'] == 'file') || (val['type'] == "multistring")) {
            if (typeof val['init'] === 'string') {
                initFuncs.push(val['init']);
            }

            if (typeof val['contents'] !== "undefined") {
                line += "<select class='playlistDetailsSelect arg_" + val['name'] + "' name='parent_" + val['name'] + "' id='" + ID + "'";
                if (typeof val['contentListUrl'] != "undefined") {
                    line += " data-contentlisturl='" + val['contentListUrl'] + "'";
                }
                if (val['type'] == "multistring") {
                    line += " multiple";
                }

                if (typeof val['children'] === 'object') {
                    if (tblCommand == 'playlistEntryCommandOptions')
                        line += " onChange='UpdateChildVisibility();";
                    if (typeof val['onChange'] === 'string') {
                        line += ' ' + val['onChange'] + '();';
                        initFuncs.push(val['onChange']);
                    }

                    line += "'";

                    var ckeys = Object.keys(val['children']);
                    for (var c = 0; c < ckeys.length; c++) {
                        for (var x = 0; x < val['children'][ckeys[c]].length; x++) {
                            children.push(val['children'][ckeys[c]][x]);
                        }
                    }
                } else {
                    if (typeof val['onChange'] === 'string') {
                        line += " onChange='" + val['onChange'] + "();'";
                        initFuncs.push(val['onChange']);
                    }
                }

                line += ">";
                $.each( val['contents'], function( key, v ) {
                       line += '<option value="' + v + '"';
                       if (v == dv) {
                            line += " selected";
                       }

                        if (Array.isArray(val['contents']))
                            line += ">" + v + "</option>";
                        else
                            line += ">" + key + "</option>";
                });
                line += "</select>";
            } else if ((typeof val['contentListUrl'] == "undefined") &&
                       (typeof val['init'] == "undefined")) {
                line += "<input class='arg_" + val['name'] + "' id='" + ID  + "' type='text' size='40' maxlength='200' value='" + dv + "'";

                if (typeof val['placeholder'] === 'string') {
                    line += " placeholder='" + val['placeholder'] + "'";
                }

                line += "></input>";
                if (configAdjustable && val['adjustable']) {
                    line += "&nbsp;<input type='checkbox' id='" + ID + "_adjustable' class='arg_" + val['name'] + "'>Adjustable</input>";
                }

                if (val['type'] == 'file') {
                    line += "&nbsp;<input type='button' value='Choose File' onclick='FileChooser(" + '"' + val['directory'] + '",".arg_' + val['name'] + '"' + ");' class='buttons'>";
                }
            } else {
                // Has a contentListUrl OR a init script
                line += "<select class='playlistDetailsSelect arg_" + val['name'] + "' id='" + ID + "'";
                if (val['type'] == "multistring") {
                    line += " multiple";
                }
                if (typeof val['contentListUrl'] != "undefined") {
                    line += " data-contentlisturl='" + val['contentListUrl'] + "'";
                }
                if (typeof val['children'] === 'object') {
                    if (tblCommand == 'playlistEntryCommandOptions')
                        line += " onChange='UpdateChildVisibility();";
                    if (typeof val['onChange'] === 'string') {
                        line += ' ' + val['onChange'] + '();';
                        initFuncs.push(val['onChange']);
                    }

                    line += "'";

                    var ckeys = Object.keys(val['children']);
                    for (var c = 0; c < ckeys.length; c++) {
                        for (var x = 0; x < val['children'][ckeys[c]].length; x++) {
                            children.push(val['children'][ckeys[c]][x]);
                        }
                    }
                } else {
                    if (typeof val['onChange'] === 'string') {
                        line += " onChange='" + val['onChange'] + "();'";
                        initFuncs.push(val['onChange']);
                    }
                }

                line += ">";
                if (val['allowBlanks']) {
                    line += "<option value=''></option>";
                }
                line += "</select>";
            }
         } else if (val['type'] == "datalist") {
            line += "<input class='arg_" + val['name'] + "' id='" + ID  + "' type='text' size='40' maxlength='200' value='" + dv + "' list='" + ID + "_list'></input>";
            line += "<datalist id='" + ID + "_list'";
            if (typeof val['contentListUrl'] != "undefined") {
                line += " data-contentlisturl='" + val['contentListUrl'] + "'";
            }
            line += ">";
            $.each( val['contents'], function( key, v ) {
                   line += '<option value="' + v + '"';
                   line += ">" + v + "</option>";
            })
            line += "</datalist>";
            contentListPostfix = "_list";
         } else if (val['type'] == "bool") {
            line += "<input type='checkbox' class='arg_" + val['name'] + "' id='" + ID  + "' value='true'";
             if (dv == "true" || dv == "1") {
                line += " checked";
             }
            line += "></input>";
         } else if (val['type'] == "color") {
            line += "<input type='color' class='arg_" + val['name'] + "' id='" + ID  + "' value='" + dv + "'></input>";
         } else if (val['type'] == "time") {
            haveTime = 1;
            line += "<input class='time center arg_" + val['name'] + "' id='" + ID + "' type='text' size='8' value='00:00:00'/>";
         } else if (val['type'] == "date") {
            haveDate = 1;
            line += "<input class='date center arg_" + val['name'] + "' id='" + ID + "' type='text' size='10' value='2020-01-01'/>";
         } else if (val['type'] == "range") {
             line += val['min'] + "<input type='range' class='arg_" + val['name'] + ",cmdArgSlider' id='" + ID  + "' min='" + val['min'] + "' max='" + val['max'] + "'";
             if (dv != "") {
                line += " value='" + dv + "'";
             } else if (typeof val['min'] != "undefined") {
                line += " value='" + val['min'] + "'";
             }
             line += "></input>" + val['max'];
         } else if ((val['type'] == "int") || (val['type'] == "float")) {
             line += "<input type='number' class='arg_" + val['name'] + "' id='" + ID  + "' min='" + val['min'] + "' max='" + val['max'] + "'";
             if (dv != "") {
                line += " value='" + dv + "'";
             } else if (typeof val['min'] != "undefined") {
                 line += " value='" + val['min'] + "'";
             }
             if (typeof val['step'] === "number") {
                line += " step='" + val['step'] + "'";
             }
             line += "></input>";

             if (typeof val['unit'] === 'string') {
                line += ' ' + val['unit'];
             }
             if (configAdjustable && val['adjustable']) {
                line += "&nbsp;<input type='checkbox' id='" + ID + "_adjustable' class='arg_" + val['name'] + "'>Adjustable</input>";
             }
         } else if (val['type'] == "subcommand") {
             line += "<select class='playlistDetailsSelect arg_" + val['name'] + "' name='parent_" + val['name'] + "' id='" + ID + "'";
             line += " onChange='SubCommandChanged(this, " + configAdjustable + ")'";
             line += " data-url='" + val['contentListUrl'] + "'";
             line += " data-count='" + count + "'";
             line += " data-tblcommand='" + tblCommand + "'";
             line += ">";
             subCommandInitFunc = function () { SubCommandChanged(ID, configAdjustable);};
             $.each( val['contents'], function( key, v ) {
                   line += '<option value="' + v + '"';
                   if (v == dv) {
                        line += " selected";
                   }

                    if (Array.isArray(val['contents']))
                        line += ">" + v + "</option>";
                    else
                        line += ">" + key + "</option>";
             });
             line += "</select>";
         }

         line += "</td></tr>";
         $('#' + tblCommand).append(line);
         if (typeof val['contentListUrl'] != "undefined") {
            var selId = "#" + tblCommand + "_arg_" + count + contentListPostfix;
            $.ajax({
                   dataType: "json",
                   url: val['contentListUrl'],
                   async: false,
                   success: function(data) {
                       if (Array.isArray(data)) {
                            $.each( data, function( key, v ) {
                              var line = '<option value="' + v + '"'
                              if (v == dv) {
                                   line += " selected";
                              }
                              line += ">" + v + "</option>";
                              $(selId).append(line);
                           })
                       } else {
                            $.each( data, function( key, v ) {
                              var line = '<option value="' + key + '"'
                              if (key == dv) {
                                   line += " selected";
                              }
                              line += ">" + v + "</option>";
                              $(selId).append(line);
                           })
                       }
                   },
            });
         }
         if (subCommandInitFunc != null) {
           subCommandInitFunc();
         }
         count = count + 1;
    });

    if (haveTime) {
        InitializeTimeInputs();
    }

    if (haveDate) {
        InitializeDateInputs();
    }

    if (tblCommand == 'playlistEntryCommandOptions')
        UpdateChildVisibility();

    for (var i = 0; i < initFuncs.length; i++) {
        if (typeof window[initFuncs[i]] == 'function' ) {
            window[initFuncs[i]]();
        }
    }
}

function ReloadContentList(baseUrl, inp) {
    var arg = $(inp);
    if (typeof inp === "string") {
        arg = $("#" + inp);
    }
    var url = arg.data("contentlisturl");
    arg.empty();
    baseUrl.split(",").forEach(function (burl) {
        $.ajax({
           dataType: "json",
           async: false,
           url: "http://" + burl + "/" + url,
           success: function(data) {
               var firstToRemove = 0;
               if (arg.find("options[0]").value == "") {
                   arg.innerHTML = "<option value=''></option>";
               }

               if (Array.isArray(data)) {
                    $.each( data, function( key, v ) {
                      var line = '<option value="' + v + '"'
                      line += ">" + v + "</option>";
                      arg.append(line);
                   })
               } else {
                    $.each( data, function( key, v ) {
                      var line = '<option value="' + key + '"'
                      line += ">" + v + "</option>";
                      arg.append(line);
                   })
               }
           }
        })});
}

function PopulateExistingCommand(json, commandSelect, tblCommand, configAdjustable = false, argPrintFunc = PrintArgInputs) {
    if (typeof json != "undefined") {
        $('#' + commandSelect).val(json["command"]);
        CommandSelectChanged(commandSelect, tblCommand, configAdjustable, argPrintFunc);
        var baseUrl = "";
        if (allowMultisyncCommands) {
            var to = typeof json['multisyncCommand'] ;

            if (typeof json['multisyncCommand'] != "undefined") {
                var val = json['multisyncCommand'];
                $("#" + tblCommand + "_multisync").prop("checked", val);
                if (val) {
                    val = json['multisyncHosts']
                    baseUrl = val;
                    $("#" + tblCommand + "_multisyncHosts_row").show();
                    $("#" + tblCommand + "_multisyncHosts").val(val);
                }
            }
        } else {
            $("#" + tblCommand + "_multisync_row").hide();
            $("#" + tblCommand + "_multisyncHosts_row").hide();
        }


        if (typeof json['args'] != "undefined") {
            var count = 1;
            $.each( json['args'], function( key, v ) {
                   var inp =  $("#" + tblCommand + "_arg_" + count);
                   if (inp.data('contentlisturl') != null && baseUrl != "") {
                       ReloadContentList(baseUrl, inp);
                   }

                   var multattr = inp.attr('multiple');
                   if (inp.attr('type') == 'checkbox') {
                       var checked = false;
                       if (v == "true" || v == "1") {
                           checked = true;
                       }
                       inp.prop( "checked", checked);
                   } else if (typeof multattr !== typeof undefined && multattr !== false) {
                       var split = v.split(",");
                       console.log(inp.attr('type') + "  " + inp.attr('multiple') + "  " + v + "  " + split + " " + split.length + "\n");

                       $("#" + tblCommand + "_arg_" + count + " option").prop("selected", function () {
                           return ~$.inArray(this.text, split);
                       });
                   } else {
                       inp.val(v);
                   }

                   if (inp.data('url') != null) {
                      SubCommandChanged(tblCommand + "_arg_" + count, configAdjustable, argPrintFunc);
                   }

                   if (typeof json['adjustable'] != "undefined"
                       && typeof json['adjustable'][count] != "undefined") {
                       $("#" + tblCommand + "_arg_" + count + "_adjustable").prop("checked", true);
                   }
                   count = count + 1;
            });
        }
    }
}

function FileChooser(dir, target)
{
    if ($('#fileChooser').length == 0) {
        var dialogHTML = "<div id='fileChooserPopup'><div id='fileChooserDiv'></div></div>";
        $(dialogHTML).appendTo('body');
    }

    $('#fileChooserPopup').fppDialog({
        height: 440,
        width: 600,
        title: "File Chooser",
        modal: true
    });
    $('#fileChooserPopup').fppDialog( "moveToTop" );
    $('#fileChooserDiv').load('fileChooser.php', function() {
        SetupFileChooser(dir, target);
    });
}

function EditCommandTemplateCanceled(row)
{
    var json = $(row).find('.cmdTmplJSON').text();
    var data = JSON.parse(json);
    $(row).find('.cmdTmplCommand').val(data.command);
}

function EditCommandTemplateSaved(row, data)
{
    FillInCommandTemplate(row, data);
}

function EditCommandTemplate(row)
{
    var command = $(row).find('.cmdTmplCommand').val();
    var json = $(row).find('.cmdTmplJSON').text();

    var cmd = {};
    if (json == '') {
        cmd.command = command;
        cmd.args = [];
        cmd.multisyncCommand = false;
        cmd.multisyncHosts = '';
    } else {
        cmd = JSON.parse(json);
        if (cmd.command != command) {
            cmd.command = command;
            cmd.args = [];
            cmd.multisyncCommand = false;
            cmd.multisyncHosts = '';
        }
    }

    ShowCommandEditor(row, cmd, 'EditCommandTemplateSaved', 'EditCommandTemplateCanceled');
}

function GetCommandTemplateData(row)
{
    var json = $(row).find('.cmdTmplJSON').text();

    if (json != '')
        return JSON.parse(json);

    var data = {};
    data.command = '';
    data.args = [];
    data.multisyncCommand = false;
    data.multisyncHosts = '';

    return data;
}

function FillInCommandTemplate(row, data)
{
    if ((row.find('.cmdTmplName').val() == '') &&
        (data.hasOwnProperty('name'))) {
        row.find('.cmdTmplName').val(data.name);
    }

    row.find('.cmdTmplCommand').val(data.command);

    if (data.hasOwnProperty('presetSlot'))
        row.find('.cmdTmplPresetSlot').val(data.presetSlot);

    if (data.args.length) {
        var args = '';
        if (data.command == 'Run Script') {
            if (data.args.length > 1)
                args = data.args[0] + ' | ' + data.args[1];
            else
                args = data.args[0];
        } else {
            args = data.args.join(' | ');
        }

        row.find('.cmdTmplArgs').html(args);
        row.find('.cmdTmplArgsTable').show();
    } else {
        row.find('.cmdTmplArgs').html('');
        row.find('.cmdTmplArgsTable').hide();
    }

    var command = {};
    command.command = data.command;
    command.args = data.args;
    var mInfo = "";
    if (data.hasOwnProperty('multisyncCommand')) {
        if (data.multisyncCommand) {
            mInfo = "<b>MCast:</b>&nbsp;Y";
        } else {
            mInfo = "<b>MCast:</b>&nbsp;N";
        }

        command.multisyncCommand = data.multisyncCommand;
        if ((data.multisyncCommand) &&
            (data.hasOwnProperty('multisyncHosts'))) {
            mInfo += " <b>Hosts:</b>&nbsp;" + data.multisyncHosts;
            command.multisyncHosts = data.multisyncHosts;
        }
    } else {
        mInfo = "<b>MCast:</b> N";
    }

    row.find('.cmdTmplMulticastInfo').html(mInfo);
    row.find('.cmdTmplJSON').html(JSON.stringify(command));

    row.find('.cmdTmplTooltipIcon').tooltip({
        content: function() {
            var json = $(this).parent().find('.cmdTmplJSON').text();
            if (json == '')
                return 'No command selected.';

            var data = JSON.parse(json);

            if (data.command == '')
                return 'No command selected.';

            var args = commandListByName[data.command]['args'];
            var tip = '<table>';

            tip += "<tr><th class='left'>Command:</th><td>" + data.command + "</td></tr>";

            if (data.hasOwnProperty('multisyncCommand')) {
                tip += "<tr><th class='left'>Multicast:</th><td>";
                if (data.multisyncCommand)
                    tip += "Yes";
                else
                    tip += "No";

                tip += "</td></tr>";

                if (data.hasOwnProperty('multisyncHosts')) {
                    tip += "<tr><th class='left'>Multicast Hosts:</th><td>" +
                        data.multisyncHosts + "</td></tr>";
                }
            }

            if (data.args.length) {
                for (var j = 0; j < args.length; j++) {
                    tip += "<tr><th class='left'>" + args[j]['description'] + ":</th><td>" + data.args[j] + "</td></tr>";
                }
            }

            tip += '</table>';

            return tip;
        },
        open: function (event, ui) {
            ui.tooltip.css("max-width", "600px");
        }
    });
}

function RunCommandJSON(cmdJSON)
{
    $.ajax({
        url: "api/command",
        type: 'POST',
        contentType: 'application/json',
        data: cmdJSON,
        async: true,
        success: function(data) {
            $.jGrowl('Command ran',{themeState:'success'});
        },
        error: function() {
            DialogError('Command failed', 'Command failed');
        }
    });
}

function RunCommand(cmd)
{
    RunCommandJSON(JSON.stringify(cmd));
}

function RunCommandSaved(item, data)
{
    if (data.command == null)
        return;

    var json = JSON.stringify(data);
    $('#runCommandJSON').html(json);

    Post('api/configfile/instantCommand.json', false, json);

    RunCommand(data);
}

function ShowRunCommandPopup()
{
    var item = $('#runCommandJSON');
    var cmd = {};
    var json = $(item).text();

    if (json != '')
        cmd = JSON.parse(json);
    else
        cmd = Get('api/configfile/instantCommand.json', false, true);

    allowMultisyncCommands = true;

    var args = {};
    args.title = 'Run FPP Command';
    args.saveButton = 'Run';
    args.cancelButton = 'Cancel';

    ShowCommandEditor(item, cmd, 'RunCommandSaved', '', args);
}

function ShowCommandEditor(target, data, callback, cancelCallback = '', args = '')
{
    if (typeof args === 'string') {
        args = {};
        args.title = 'FPP Command Editor';
        args.saveButton = 'Accept Changes';
        args.cancelButton = 'Cancel Edit';
    }

    allowMultisyncCommands = true;

    if ($('#commandEditorPopup').length == 0) {
        var dialogHTML = "<div id='commandEditorPopup'><div id='commandEditorDiv'></div></div>";
        $(dialogHTML).appendTo('body');
    }

    $('#commandEditorPopup').fppDialog({
        height: 'auto',
        width: 600,
        title: args.title,
        modal: true,
        open: function(event, ui) { $('#commandEditorPopup').parent().find(".ui-dialog-titlebar-close").hide(); },
        closeOnEscape: false
    });
    $('#commandEditorPopup').fppDialog( "moveToTop" );
    $('#commandEditorDiv').load('commandEditor.php', function() {
        CommandEditorSetup(target, data, callback, cancelCallback, args);
    });
}

function PreviewSchedule()
{
    if ($('#schedulePreviewPopup').length == 0) {
        var dialogHTML = "<div id='schedulePreviewPopup'><div id='schedulePreviewDiv'></div></div>";
        $(dialogHTML).appendTo('body');
    }

    $('#schedulePreviewDiv').html('');
    $('#schedulePreviewPopup').fppDialog({
        width: 900,
        title: "Schedule Preview",
        modal: true
    });
    $('#schedulePreviewPopup').fppDialog( "moveToTop" );
    $('#schedulePreviewDiv').load('schedulePreview.php');
}

function ToggleMenu() {
    if (gblNavbarMenuVisible == 1) {
        $('html').removeClass('nav-open');
        gblNavbarMenuVisible = 0;
        $('#bodyClick').fadeOut("slow", function (){ $('#bodyClick').remove();});
    } else {
        div = '<div id="bodyClick"></div>';
        $(div).appendTo("body").click(function() {
            $('.navbar-toggler').trigger("click");
            $('html').removeClass('nav-open');
            gblNavbarMenuVisible = 0;
        });
        $('html').addClass('nav-open');
        gblNavbarMenuVisible = 1;
    }
}

/*
* Simply Loads the current system status into a JSON variable.
* Other functions can either call the variable as a on-off or subscribe to changes.
*/
function LoadSystemStatus(){
    $.ajax({
        url: 'api/system/status',
        dataType: 'json',
        success: function(response, reqStatus, xhr) {
            if(response && typeof response === 'object') {
                lastStatusJSON = response;
                lastStatus = response.status;
                //Call any "listeners"
                statusChangeFuncs.forEach(func => {
                    func();
                });
            }
        },
        complete: function() {
            clearTimeout(statusTimeout);
            statusTimeout = setTimeout(LoadSystemStatus, gblStatusRefreshSeconds*1000);
        }
    });
}

/*
* How often should the page call api/system/status
*/
function SetStatusRefreshSeconds(seconds){
    if(seconds == undefined) return;
    if(!Number.isInteger(seconds) ) return;
    if(seconds <1) return;
    gblStatusRefreshSeconds = seconds;
}

/*
* Pass your function to this and it will be executed when the system status API is called
*/
function OnSystemStatusChange(funcToCall){
    statusChangeFuncs.push(funcToCall);
}

/*
* Called each time the system status JSON is updated to refresh icons in the header bar.
*/
var headerCache = {}; //Used to cache what we've displayed on screen so we only update it if it has changed
function RefreshHeaderBar(){
    var data = lastStatusJSON;
    if(data == undefined || data == null) return;
    if(data.interfaces != undefined){
        var rc = [];
        
        data.interfaces.forEach(function (e) {
            if (e.ifname === "lo") { return 0; }
            if (e.ifname.startsWith("eth0:0")) { return 0; }
            if (e.ifname.startsWith("usb")) { return 0; }
            if (e.ifname.startsWith("can.")) { return 0; }
            e.addr_info.forEach(function (n) {
                if (n.family === "inet" && (n.local == "192.168.8.1" || e.ifname.startsWith("SoftAp") || e.ifname.startsWith("tether"))) {
                    var row = '<span title="Tether IP: ' + n.local + '"><i class="fas fa-broadcast-tower"></i><small>' + e.ifname + '</small></span>';
                    rc.push(row);
                }else if (n.family === "inet" && "wifi" in e) {
                    var row = '<span title="IP: ' + n.local + '<br/>Strength: ' + e.wifi.level + 'dBm" class="ip-wifi wifi-' + e.wifi.desc + '"><small>' + e.ifname + '</small></span>';
                    rc.push(row);
                }else if (n.family === "inet") {
                    var icon = "text-success";
                    if(n.local.startsWith("169.254.") && e.flags.includes("DYNAMIC")){
                        icon = "text-warning";
                    }else if(e.flags.includes("STATIC") && e.operstate != "UP"){
                        icon = "text-danger";
                    }
                    var row = '<span title="IP: ' + n.local + '" ><i class="fas fa-network-wired ' + icon + '"></i><small>' + e.ifname + '</small></span>';
                    rc.push(row);
                }
            });
        });
        if(headerCache.Interfaces != rc.join("")){
            $("#header_IPs").html(rc.join(""));
            headerCache.Interfaces = rc.join("");
        }
    }

    if(data.sensors != undefined){
        var sensors = [];
        var tooltip = "";
        data.sensors.forEach(function (e) {
            var icon = "bolt";
            var val = e.formatted;
            if(e.valueType == "Temperature"){
                var inF = settings['temperatureInF'] == 1;
                icon = "thermometer-half";
                if(inF) {
                    val = (val*1.8)+32;
                    val = parseFloat(val).toFixed(2);
                    val += '&deg;F';
                }else{
                    val += '&deg;C';
                }
            }
            tooltip += '<b>' + e.label +'</b>'+ val +'<br/>';
            row = '<span onclick="RotateHeaderSensor('+(sensors.length+1)+')" data-sensorcount="'+sensors.length+'" style="display:none" title="TOOLTIP_DETAILS"><i class="fas fa-'+icon+'"></i><small>' + e.label + val + '</small></span>';
            sensors.push(row);
        });
        var sensorsJoined = sensors.join("");
        sensorsJoined = sensorsJoined.replace(/TOOLTIP_DETAILS/g,tooltip);
        if(headerCache.Sensors != sensorsJoined){
            $("#header_sensors").html(sensorsJoined);
            headerCache.Sensors = sensorsJoined;
            if(sensors.length > 1) $("#header_sensors").css("cursor","pointer");
            if($("#header_sensors").data("defaultsensor") != undefined 
                    && Number.isInteger($("#header_sensors").data("defaultsensor"))){
                RotateHeaderSensor($("#header_sensors").data("defaultsensor"));
            }else{
                RotateHeaderSensor(0);
            }
        }
        
    }

    if ((data.timeStr != undefined) && (data.dateStr != undefined)) {
        var row = "";
        if ((window.location.href.indexOf('index.php') >= 0) ||
            (window.location.href.endsWith('/'))) {
            row += "<span><small>" + data.dateStr + "</small><small>" + data.timeStrFull + "</small></span>";
        } else {
            row += "<span><small>" + data.dateStr + "</small><small>" + data.timeStr + "</small></span>";
        }
        row += "<!-- " + window.location.href + " -->";

        if (headerCache.Time != row) {
            $('#header_Time').html(row);
            headerCache.Time = row;
        }
    } else {
        $('#header_Time').hide();
    }

    if(data.status_name != undefined){
        var row = "";
        if(data.status_name == "playing"){
            var title = "Playing";
            if(data.current_sequence != undefined){
                title += ': '+data.current_sequence;
            }
            row = '<span title="'+title+'"><i class="fas fa-play text-success"></i><small>Playing</small></span>';
        }else if(data.status_name == "idle"){
            row = '<span title="Idle"><i class="fas fa-pause"></i><small>Idle</small></span>';
        }else if(data.status_name == "stopped"){
            row = '<span title="FPPD Stopped"><i class="fas fa-stop text-danger"></i><small>FPPD Stopped</small></span>';
        }
        if(headerCache.Player != row){
            $("#header_player").html(row);
            headerCache.Player = row;
        }
    }
    if(data.mode_name != undefined){
        $("#fppModeDropdownButtonModeText").html( data.mode_name =="player"?"Standalone" : data.mode_name );
    }

    if(data.advancedView.HostDescription){
        var hostDetails = "Host: "+data.advancedView.HostName+"<br/>Desc: "+data.advancedView.HostDescription;
        if(headerCache.HostDetails != hostDetails){
            $(".headerHostName>span").attr("title", hostDetails);
            headerCache.HostDetails = hostDetails;
        }
    }

}

/*
* Used to rotate through the sensors in the header bar
*/
function RotateHeaderSensor(goto){
    var currentDefault = $("#header_sensors").data("defaultsensor");
    var visible = $("#header_sensors span:visible").length;
    if(currentDefault == goto && visible > 0) return;
    
    var current = $("#header_sensors").find("[data-sensorcount='" + (goto-1) + "']");
    var next = $("#header_sensors").find("[data-sensorcount='" + goto + "']"); 
    if(next.length == 0) next = $("#header_sensors").find("[data-sensorcount='0']"); 
    current.hide();
    next.show();

    //Save setting
    if(currentDefault == goto) return;
    $.put("api/settings/currentHeaderSensor", goto);
    $("#header_sensors").data("defaultsensor", goto);
}

function PreviewStatistics() {
    if ($('#statsPreviewPopup').length == 0) {
        var dialogHTML = "<div id='statsPreviewPopup'><pre><div id='statsPreviewDiv'></div></pre></div>";
        $(dialogHTML).appendTo('body');
    }

    $('#statsPreviewDiv').html('Loading...');
    $('#statsPreviewPopup').fppDialog({
        width: 900,
        title: "Statistics Preview",
        modal: true
    });
    $('#statsPreviewPopup').fppDialog( "moveToTop" );
    $('#statsPreviewDiv').load('api/statistics/usage');
}
