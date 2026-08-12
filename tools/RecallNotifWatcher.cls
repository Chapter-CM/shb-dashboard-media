VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
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
' Nghe su kien Outlook.Items.ItemAdd tren Inbox - moi khi co mail MOI
' ve toi Inbox, tu dong kiem tra va XOA VINH VIEN NGAY neu la mail
' thong bao "Message Recall Success/Failure" (khong qua Deleted Items -
' xem ghi chu trong InboxItems_ItemAdd). Chay SONG SONG voi
' RecallCampaign() dang gui recall (khong can doi recall xong roi chay
' rieng buoc don dep nhu CleanRecallNotifications()).
'
' CACH IMPORT (VBA Editor - Alt+F11):
'   File > Import File... > chon file RecallNotifWatcher.cls nay.
'   (Khac voi CampaignTracker.bas - .cls phai import nhu 1 class module
'   rieng, khong dan noi dung vao module thuong duoc.)
'
' CACH DUNG: khong goi truc tiep class nay - dung 2 macro
' StartRecallNotificationWatcher() / StopRecallNotificationWatcher()
' trong CampaignTracker.bas (RecallCampaign() cung tu dong bat watcher
' truoc khi chay batch).
'
' LUU Y: watcher chi song trong PHIEN Outlook hien tai (bien module-
' level bi mat khi dong Outlook hoac VBA project bi reset). Neu dong
' Outlook giua chung, phai chay lai StartRecallNotificationWatcher().
' ================================================================

Public WithEvents InboxItems As Outlook.Items

Private Sub InboxItems_ItemAdd(ByVal Item As Object)
    On Error Resume Next
    If Item.Class = olMail Then
        Dim subj As String: subj = Item.subject
        If Left(subj, 22) = "Message Recall Success" Or _
           Left(subj, 22) = "Message Recall Failure" Then
            ' Xoa VINH VIEN, khong qua Deleted Items: goi .Delete 2 LAN LIEN
            ' TIEP. Lan 1 chuyen item tu Inbox sang Deleted Items (xoa mem
            ' binh thuong). Lan 2, vi luc nay item da nam trong Deleted Items,
            ' .Delete tren chinh no se XOA THAT SU (khong con noi nao de
            ' "chuyen" toi nua) - day la cach chuan de permanent-delete tu VBA
            ' ma khong can Extended MAPI/Redemption.
            Item.Delete
            Item.Delete
        End If
    End If
    On Error GoTo 0
End Sub
