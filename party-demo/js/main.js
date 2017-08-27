function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}


var chatroomId = location.search && location.search.split('?')[1];

var source = 'wss://kt7.picowork.com',
    currentUser = {
        id: guid(),
        nickname: 'host',
        sign: guid()
    },
    senderRTC = null,
    senderRTCMap = {},
    wsKMap = {},
    wsK = null,
    count = 0,
    candidatesQueue = {},
    callType = 'video', //set to audio to do audio testing
    isComposite = (callType === 'audio') ? true : false,
    video_enabled = true,
    audio_enabled = true;

function onIceCandidate(candidate) {
    //$('#info').append("local candidate\n");//causes problem
    //console.log('local candidate' + JSON.stringify(candidate));
    wsK.emit('KURENTO_ICE_CANDIDATE', {
        roomId: chatroomId,
        userId: currentUser.id,
        candidate: candidate,
        type: 'local'
    });
}

function setRoom(name) {
    $('#sessionInput').remove();
    $('#start').remove();
    $('h1').text(name);
    $('#subTitle').text('Link to join: ' + location.href);
    create();
    $('.btn-group').show();
}

if (chatroomId) {
    setRoom(chatroomId);
}

function start() {

    var roomId = $('#sessionInput').val();
    if (!roomId) {
        alert('at least give a room name');
        return;
    }

    var newUrl = location.pathname + '?' + roomId;
    history.replaceState({
        foo: 'bar'
    }, null, newUrl);
    setRoom(roomId);

}

function create() {
    wsK = io.connect(source, {
        forceNew: true,
        query: 'user=' + encodeURIComponent(JSON.stringify({
            user: {
                id: currentUser.id,
                nickname: currentUser.nickname
            },
            signature: currentUser.sign,
            cate: 'PARTY'
        }))
    });


    wsK.on('connect', function() {
        if (!isComposite) {
            var options = {
                localVideo: document.getElementById('videoOutput'),
                onicecandidate: onIceCandidate,
                mediaConstraints: {
                    audio: true,
                    video: callType === 'audio' ? false : true
                }
            };

            console.log('sender side mediaConstraint: ', options.mediaConstraints);

            senderRTC = kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function(error) {
                if (error) {
                    $('#info').append(error + "\n");
                    console.error(error);
                    return;
                }

                this.generateOffer(function(error, offerSdp) {
                    if (error) {
                        $('#info').append(error + "\n");
                        console.error(error);
                        return;
                    }

                    wsK.emit('KURENTO_JOIN_ROOM', {
                        data: {
                            roomId: chatroomId,
                            sender: {
                                id: currentUser.id,
                                nickname: currentUser.nickname
                            },
                            callType: callType,
                            sdpOffer: offerSdp,
                            inviteUsers: '',
                            isComposite: isComposite,
                            isRecord: false
                        },
                        signature: currentUser.sign
                    });


                });

            });
        } else {
            var options = {
                localVideo: document.getElementById('videoOutput'),
                remoteVideo: document.getElementById('compositeOutput'),
                onicecandidate: onIceCandidate,
                mediaConstraints: {
                    audio: true,
                    video: callType === 'audio' ? false : true
                }
            };

            senderRTC = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function(error) {
                if (error) {
                    console.log('Error creating senderRTC', error);
                    return;
                }
                this.generateOffer(function(error, sdpOffer) {
                    if (error) {
                        console.log('Error generateOffer', error);
                        return;
                    }

                    wsK.emit('KURENTO_JOIN_ROOM', {
                        data: {
                            roomId: chatroomId,
                            sender: {
                                id: currentUser.id,
                                nickname: currentUser.nickname
                            },
                            callType: callType,
                            sdpOffer: sdpOffer,
                            inviteUsers: '',
                            isComposite: isComposite,
                            isRecord: false
                        },
                        signature: currentUser.sign
                    });
                });
            });
        }

        wsK.on('KURENTO_JOIN_ROOM', function(data) {
            $('#info').append(data.participants.length + "\n");
            // console.log('wsK join room', data);

            if (data.joinUser === currentUser.id) {
                senderRTC.processAnswer(data.sdpAnswer);

                if (data.status === 'joining') {
                    wsK.emit('KURENTO_START_ROOM', {
                        data: {
                            roomId: chatroomId,
                            sender: {
                                id: currentUser.id,
                                nickname: currentUser.nickname
                            }
                        },
                        signature: currentUser.sign
                    });
                } else if (data.status === 'running') {
                    //    $('#info').append("room is ready\n");
                    console.log('room is ready');
                    console.log('getting video from existing user if there is any: ' + chatroomId);
                    _processExistingUsers(data);
                    wsK.emit('KURENTO_JOIN_READY', {
                        data: {
                            roomId: chatroomId,
                            sender: {
                                id: currentUser.id,
                                nickname: currentUser.nickname
                            }
                        },
                        signature: currentUser.sign
                    });
                }
            }

        });

        wsK.on('KURENTO_REMOTE_JOIN_ROOM', function(data) {
            if (data.joinUser !== currentUser.id) {
                console.log('REMOTE_JOIN_ROOM ' + data.joinUser + 'has joined the room, trying to get remote video, creating RTC Peer: ' + chatroomId, data);
                if (!senderRTCMap[data.joinUser] || !senderRTCMap[data.joinUser].recvRTC) {
                    senderRTCMap[data.joinUser] = {};
                    _processRemoteJoinRoom(data);
                }
            }
        });



        function _processExistingUsers(data) {
            console.log('Entering _processingExistingUser', data);

            if (data.participantsObj && Object.keys(data.participantsObj).length > 0) {
                console.log("currentUser.Id: " + currentUser.id);
                for (var participant in data.participantsObj) {
                    (function(participant) {
                        if (participant !== currentUser.id && data.participantsObj[participant].fsm.current === 'added') {
                            console.log('Getting remote video from - ' + participant + ' : ' + chatroomId + ', data : ', data);
                            console.log("processExistingUsers", participant);
                            senderRTCMap[participant] = {};
                            data.joinUser = participant;
                            _processRemoteJoinRoom(data);
                        }
                    }(participant));
                }
            }
        }

        function _processRemoteJoinRoom(data) {
            if (!data.joinUser || !senderRTCMap[data.joinUser]) {
                console.error('participant gone', data);
                return;
            }

            console.log("data.joinUser: ", data.joinUser, data);

            var callTypeHere;

            if (data && data.participantsObj && data.participantsObj[data.joinUser]) {
                callTypeHere = data.participantsObj[data.joinUser].callType;
            } else if (senderRTCMap[data.joinUser].callType) {
                callTypeHere = senderRTCMap[data.joinUser].callType;
            } else {
                callTypeHere = 'video';
            }

            var video = callTypeHere === 'video' ? true : false,
                mandatory = callTypeHere && {
                    'offerToReceiveVideo': (callTypeHere === 'video')
                } || {},
                mediaConstraint = {
                    "audio": true,
                    "video": video,
                    "mandatory": mandatory
                };

            console.log('media constraint: ', mediaConstraint);


            if (!isComposite) {
                $('.flex-container').append(
                    '<li id="' + data.joinUser + '" class="flex-item"><video id="videoOutput' + data.joinUser + '" autoplay data-js-nickname="' + data.joinUser + '"></video><div class="icon-group"><span data-js="iconVideo"><i class="glyphicon glyphicon-facetime-video" aria-hidden="true"></i></span><span data-js="iconAudio"><i class="glyphicon glyphicon-volume-up" aria-hidden="true"></i></span></div><textarea id="info' + data.joinUser + '" class="form-control" rows="3"></textarea></li>');
                //prevention of js closure
                var scopeUser = data.joinUser;

                var options = {
                    localVideo: undefined,
                    joinUser: scopeUser,
                    remoteVideo: document.getElementById('videoOutput' + scopeUser),
                    onicecandidate: function(candidate) {
                        $('#info' + scopeUser).append("local candidate\n");
                        //console.log('local candidate ' + scopeUser + '-' + JSON.stringify(candidate));

                        wsK.emit('KURENTO_ICE_CANDIDATE', {
                            roomId: chatroomId,
                            userId: scopeUser,
                            candidate: candidate,
                            type: 'remote'
                        });
                    },
                    mediaConstraints: {
                        video: video
                    }
                };
                // console.log('options: ', scopeUser,  options);

                senderRTCMap[data.joinUser].recvRTC = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function(error) {
                    console.log('RTC peer for ' + options.joinUser + ' is created, trying to get remote video stream: ' + chatroomId);
                    if (error) {
                        $('#info' + options.joinUser).append(error + "\n");
                        console.error(error);
                        return;
                    }

                    this.generateOffer(function(error, sdpOffer) {
                        if (error) {
                            $('#info' + options.joinUser).append(error + "\n");
                            console.error('error generate offer ', error);
                            return;
                        }

                        wsK.emit('KURENTO_RECEIVE_VIDEO_FROM', {
                            data: {
                                roomId: chatroomId,
                                sender: {
                                    id: currentUser.id,
                                    nickname: currentUser.nickname
                                },
                                target: {
                                    id: options.joinUser
                                },
                                sdpOffer: sdpOffer
                            },
                            signature: currentUser.sign
                        });
                    });
                });
            } //isComposite
        } //end of processRemoteJoinRoom

        function _processVideoResponse(data) {
            console.log('_processVideoResponse - ', data);
            if (!senderRTCMap[data.targetId].recvRTC) {
                console.log('recvRTC is missing', data);
                return;
            }

            senderRTCMap[data.targetId].recvRTC.processAnswer(data.sdpAnswer, function(processError) {
                var candidate;

                if (!processError) {
                    console.log('connected remote stream - ' + data.targetId + ' : ' + chatroomId);

                    if (!candidatesQueue[data.targetId]) {
                        console.error('error ICE_CANDIDATE does not match user', senderRTCMap, data);
                    } else {
                        while (candidatesQueue[data.targetId].length) {
                            candidate = candidatesQueue[data.targetId].shift();
                            senderRTCMap[data.targetId].recvRTC.addIceCandidate(candidate);
                        }
                    }
                } else {
                    console.log('unable to connect to remote stream - ' + data.targetId + ' : ' + chatroomId, processError);
                }
            });
        }

        function _processLeaveRoom(data) {
            if (!isComposite) {
                if (data.senderId !== currentUser.id) {
                    console.log(data.senderId + 'left room: ' + chatroomId, data);
                    senderRTCMap[data.senderId].recvRTC.dispose();
                    senderRTCMap[data.senderId].recvRTC = null;
                    delete senderRTCMap[data.senderId];
                    var remotes = document.getElementById("remotes");
                    var el = document.getElementById(data.senderId);
                    if (remotes && el) {
                        remotes.removeChild(el);
                    }
                }
            }
        }

        wsK.on('KURENTO_RECEIVE_VIDEO_RESPONSE', function(data) {
            if (data.senderId === currentUser.id) {
                console.log('received remote video stream response - ' + data.targetId + ' trying to connect stream: ' + chatroomId, data);
                _processVideoResponse(data);
            }
        });

        wsK.on('KURENTO_LEAVE_ROOM', function(data) {
            console.log('received LEAVE_ROOM', data);
            _processLeaveRoom(data);
        });

        wsK.on('KURENTO_ICE_CANDIDATE', function(data) {
            //console.log("jake1 , ", chatroomId, data, senderRTCMap, candidatesQueue );
            if (data.type === 'local') {
                senderRTC.addIceCandidate(data.candidate);
            } else if (data.type === 'remote' && data.userId) {
                if (!candidatesQueue[data.userId]) {
                    candidatesQueue[data.userId] = [];
                }
                candidatesQueue[data.userId].push(data.candidate);
            } else {
                console.error('wsk on command Ice candidate error, ', data);
            }

        });


        wsK.on('KURENTO_MUTE_VIDEO', function(data) {
            console.info('Kurento - received MUTE_VIDEO', data);
            if (data.roomId === chatroomId && data.senderId && data.senderId !== currentUser.id) {
                senderRTCMap[data.senderId].video = data.enabled;
                toggleCamera(data.enabled, data.senderId);
            }
        });

        wsK.on('KURENTO_MUTE_AUDIO', function(data) {
            console.info('Kurento - received MUTE_AUDIO', data);
            if (data.roomId === chatroomId && data.senderId && data.senderId !== currentUser.id) {
                senderRTCMap[data.senderId].audio = data.enabled;
                toggleAudio(data.enabled, data.senderId);
            }
        });

        // wsk connect 
    });

    wsK.on('disconnect', function() {
        $('#info').append("wsK got disconnected\n");
        console.log('wsK got disconnected');
    });
} //end of create

// enabled camera
function toggleCamera(flag, targetId) {
    if (typeof targetId === 'undefined') {
        video_enabled = !video_enabled;
        if (video_enabled) {
            $('[data-js="btnVideo"]').removeClass('btn-warning');
        } else {
            $('[data-js="btnVideo"]').addClass('btn-warning');
        }
        try {
            senderRTC.pc.getLocalStreams()[0].getVideoTracks()[0].enabled = video_enabled;
        } catch (e) {
            senderRTC.peerConnection.getLocalStreams()[0].getVideoTracks()[0].enabled = video_enabled;
        }

        wsK.emit('KURENTO_MUTE_VIDEO', {
            data: {
                roomId: chatroomId,
                sender: {
                    id: currentUser.id,
                    nickname: currentUser.nickname
                },
                enabled: video_enabled
            },
            signature: currentUser.sign
        });
    } else {
        if (senderRTCMap[targetId].video) {
            $('#' + targetId).find('[data-js="iconVideo"]').removeClass('text-warning');
        } else {
            $('#' + targetId).find('[data-js="iconVideo"]').addClass('text-warning');
        }
    }
};

// enabled audio
function toggleAudio(flag, targetId) {
    if (typeof targetId === 'undefined') {
        audio_enabled = !audio_enabled;
        if (audio_enabled) {
            $('[data-js="btnAudio"]').removeClass('btn-warning');
        } else {
            $('[data-js="btnAudio"]').addClass('btn-warning');
        }
        try {
            senderRTC.pc.getLocalStreams()[0].getAudioTracks()[0].enabled = audio_enabled;
        } catch (e) {
            senderRTC.peerConnection.getLocalStreams()[0].getAudioTracks()[0].enabled = audio_enabled;
        }

        wsK.emit('KURENTO_MUTE_AUDIO', {
            data: {
                roomId: chatroomId,
                sender: {
                    id: currentUser.id,
                    nickname: currentUser.nickname
                },
                enabled: audio_enabled
            },
            signature: currentUser.sign
        });
    } else {
        if (senderRTCMap[targetId].audio) {
            $('#' + targetId).find('[data-js="iconAudio"]').removeClass('text-warning');
        } else {
            $('#' + targetId).find('[data-js="iconAudio"]').addClass('text-warning');
        }
    }
}

// hangup
function hangup() {
    try {
        if (senderRTC) {
            if (senderRTC.stream && senderRTC.stream.active) {
                tracks = senderRTC.stream.getTracks();
                tracks.forEach(function(track) {
                    track.stop();
                });
            } else if (senderRTC.stream && senderRTC.stream.stop) {
                senderRTC.stream.stop();
            }
            senderRTC.dispose();
            senderRTC = null;
        }
    } catch (e) {
        console.error('Kurento - senderRTC dispose failed', e);
    }

    if (typeof senderRTCMap === 'object') {
        for (var _index in senderRTCMap) {
            var item = senderRTCMap[_index];
            item.recvRTC.dispose();
            item.recvRTC = null;
            item = null;
        }
    }

    $('#remotes').find('li').remove();

    senderRTCMap = {};
    wsKMap = {};
    count = 0;
    candidatesQueue = {};
    video_enabled = true;
    audio_enabled = true;
    if (wsK) {
        wsK.disconnect();
        wsK = null;
    }
    window.location.href = window.location.origin + window.location.pathname;
}

$(window).on('unload', function() {
    hangup();
});
