import { Component, OnDestroy } from '@angular/core';
import { OnInit } from '@angular/core';
import { ApiService } from '../Services/ApiService';
import { Router } from '@angular/router';
import { KahlaUser } from '../Models/KahlaUser';
import { AiurEvent } from '../Models/AiurEvent';
import { EventType } from '../Models/EventType';
import { NewMessageEvent } from '../Models/NewMessageEvent';
import { ConversationsComponent } from './conversations.component';
import { TalkingComponent } from './talking.component';
import { FriendsComponent } from './friends.component';
import { NavComponent } from './nav.component';
import { HeaderComponent } from './header.component';
import { FriendRequestsComponent } from './friendrequests.component';
import { Notify } from '../Services/Notify';
import { CacheService } from '../Services/CacheService';
import { Values } from '../values';
import 'sweetalert';

@Component({
    selector: 'app-kahla',
    templateUrl: '../Views/app.html',
    styleUrls: ['../Styles/app.css']
})
export class AppComponent implements OnInit, OnDestroy {
    public static me: KahlaUser;
    public static CurrentHeader: HeaderComponent;
    public static CurrentNav: NavComponent;
    public static CurrentTalking: TalkingComponent;
    public static CurrentConversation: ConversationsComponent;
    public static CurrentFriend: FriendsComponent;
    public static CurrentApp: AppComponent;
    public static CurrentFriendRequests: FriendRequestsComponent;
    public ws: WebSocket;
    public wsconnected = false;
    constructor(
        private apiService: ApiService,
        private router: Router,
        private notify: Notify,
        private cache: CacheService) {
        AppComponent.CurrentApp = this;
    }

    public ngOnInit(): void {
        this.check();
        this.apiService.SignInStatus().subscribe(signInStatus => {
            if (signInStatus.value === false) {
                this.router.navigate(['/kahla/signin']);
            } else {
                this.apiService.Me().subscribe(p => {
                    AppComponent.me = p.value;
                });
                this.cache.AutoUpdateConversations(AppComponent.CurrentNav);
                this.LoadPusher();
            }
        });
    }

    public check(): void {
        this.apiService.Version()
            .subscribe(t => {
                if (t.latestVersion === Values.currentVersion) {
                } else {
                    swal({
                        title: 'There is a new version of Kahla!',
                        text: 'Do you want to download the latest version of Kahla now?',
                        icon: 'info',
                        buttons: [true, 'Download now'],
                        dangerMode: false,
                    }).then(ToDownload => {
                        if (ToDownload) {
                            location.href = t.downloadAddress;
                        }
                    });
                }
            });
    }

    public LoadPusher(): void {
        this.apiService.InitPusher().subscribe(model => {
            this.ws = new WebSocket(model.serverPath);
            this.ws.onopen = () => this.wsconnected = true;
            this.ws.onmessage = this.OnMessage;
            this.ws.onerror = this.OnError;
            this.ws.onclose = this.OnError;
            if ('Notification' in window) {
                Notification.requestPermission();
            }
        });
    }

    public Reconnect(): void {
        this.ngOnInit();
        if (AppComponent.CurrentConversation) {
            AppComponent.CurrentConversation.ngOnInit();
        } else if (AppComponent.CurrentFriend) {
            AppComponent.CurrentFriend.ngOnInit();
        } else if (AppComponent.CurrentTalking) {
            AppComponent.CurrentTalking.getMessages(true, AppComponent.CurrentTalking.conversation.id);
        }
    }

    public OnMessage(data: MessageEvent): void {
        const ev = JSON.parse(data.data) as AiurEvent;
        switch (ev.type) {
            case EventType.NewMessage:
                const evt = ev as NewMessageEvent;
                if (AppComponent.CurrentTalking && AppComponent.CurrentTalking.conversation.id === evt.conversationId) {
                    AppComponent.CurrentApp.notify.ShowNewMessage(evt, AppComponent.me.id);
                    AppComponent.CurrentTalking.getMessages(true, AppComponent.CurrentTalking.conversation.id);
                } else if (AppComponent.CurrentConversation) {
                    AppComponent.CurrentConversation.ngOnInit();
                    AppComponent.CurrentApp.notify.ShowNewMessage(evt, AppComponent.me.id);
                } else {
                    AppComponent.CurrentApp.cache.AutoUpdateUnread(AppComponent.CurrentNav);
                    AppComponent.CurrentApp.notify.ShowNewMessage(evt, AppComponent.me.id);
                }
                break;
            case EventType.NewFriendRequest:
                swal('Friend request', 'You have got a new friend request!', 'info');
                if (AppComponent.CurrentFriendRequests) {
                    AppComponent.CurrentFriendRequests.ngOnInit();
                } else {
                    AppComponent.CurrentApp.cache.AutoUpdateConversations(AppComponent.CurrentNav);
                }
                break;
            case EventType.WereDeletedEvent:
                swal('Were deleted', 'You were deleted by one of your friends from his friend list.', 'info');
                if (AppComponent.CurrentConversation) {
                    AppComponent.CurrentConversation.ngOnInit();
                } else if (AppComponent.CurrentFriend) {
                    AppComponent.CurrentFriend.ngOnInit();
                } else {
                    AppComponent.CurrentApp.cache.AutoUpdateUnread(AppComponent.CurrentNav);
                }
                break;
            case EventType.FriendAcceptedEvent:
                swal('Friend request', 'Your friend request was accepted!', 'success');
                if (AppComponent.CurrentConversation) {
                    AppComponent.CurrentConversation.ngOnInit();
                } else if (AppComponent.CurrentFriend) {
                    AppComponent.CurrentFriend.ngOnInit();
                }
                break;
        }
    }

    public destory(): void {
        if (this.ws !== null && this.ws !== undefined) {
            this.ws.onclose = function () { };
            this.ws.onmessage = function () { };
            this.ws.close();
            this.ws = null;
        }
        this.wsconnected = false;
    }

    public OnError(): void {
        setTimeout(function () {
            AppComponent.CurrentApp.Reconnect();
        }, 10000);
    }

    public ngOnDestroy(): void {
        AppComponent.CurrentApp = null;
    }
}
