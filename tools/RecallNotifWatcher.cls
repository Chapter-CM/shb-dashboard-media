VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
End
Attribute VB_Name = "RecallNotifWatcher"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False
Option Explicit

' ================================================================
' RecallNotifWatcher - CLASS MODULE (import rieng, khong phai standard
' module nhu CampaignTracker.bas)
'
' Nghe su kien Outlook.Items.ItemAdd tren Inbox - moi khi co item MOI
' ve toi Inbox, tu dong kiem tra va XOA NGAY neu la thong bao
' "Message Recall Success/Failure". Chay SONG SONG voi RecallCampaign()
' dang gui recall (khong can doi recall xong roi chay rieng buoc don
' dep nhu CleanRecallNotifications()).
'
' QUAN TRONG: thong bao "Message Recall Success/Failure" cua Outlook la
' loai ReportItem (Item.Class = olReport = 39), KHONG PHAI MailItem
' thuong (olMail = 43). Ban dau code chi loc "If Item.Class = olMail"
' nen bo qua hoan toan cac thong bao nay - watcher chay dung (bat duoc
' su kien ItemAdd) nhung khong bao gio xoa duoc gi vi dieu kien Class
' luon sai. Sua: bo dieu kien loc Class, doc .subject truc tiep tren
' MOI item (ca MailItem lan ReportItem deu co thuoc tinh .Subject).
'
' XOA VINH VIEN (khong chi chuyen vao Deleted Items): Item.Delete tren 1
' item dang nam trong Inbox chi CHUYEN no vao Deleted Items (van chiem
' dung luong, campaign lon van co the lam day hop thu). Them 1 WithEvents
' thu 2 (DeletedItemsItems) theo doi luon thu muc Deleted Items - khi
' thong bao vua bi chuyen toi do, goi Delete THEM 1 LAN NUA ngay tai do:
' xoa 1 item dang nam san trong Deleted Items se XOA VINH VIEN (khong
' con noi nao de chuyen tiep toi nua) - dung hanh vi chuan cua Outlook.
'
' CACH IMPORT (VBA Editor - Alt+F11):
'   File > Import File... > chon file RecallNotifWatcher.cls nay.
'   (Khac voi CampaignTracker.bas - .cls phai import nhu 1 class module
'   rieng, khong dan noi dung vao module thuong duoc.)
'
' CACH DUNG: khong goi truc tiep class nay - RecallCampaign() trong
' CampaignTracker.bas tu dong tao watcher moi truoc khi chay batch.
'
' LUU Y: watcher chi song trong PHIEN Outlook hien tai (bien module-
' level bi mat khi dong Outlook hoac VBA project bi reset). Neu dong
' Outlook giua chung, phai chay lai RecallCampaign() de watcher tu bat
' lai (code trong CampaignTracker.bas tu dong lam dieu nay).
' ================================================================

Public WithEvents InboxItems As Outlook.Items
Public WithEvents DeletedItemsItems As Outlook.Items

Private Sub InboxItems_ItemAdd(ByVal Item As Object)
    On Error Resume Next
    Dim subj As String: subj = Item.subject
    If Left(subj, 22) = "Message Recall Success" Or _
       Left(subj, 22) = "Message Recall Failure" Then
        Item.Delete
    End If
    On Error GoTo 0
End Sub

Private Sub DeletedItemsItems_ItemAdd(ByVal Item As Object)
    On Error Resume Next
    Dim subj As String: subj = Item.subject
    If Left(subj, 22) = "Message Recall Success" Or _
       Left(subj, 22) = "Message Recall Failure" Then
        ' Item dang o Deleted Items - Delete lan nay la xoa VINH VIEN.
        Item.Delete
    End If
    On Error GoTo 0
End Sub
