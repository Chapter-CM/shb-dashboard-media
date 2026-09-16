VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
End
Attribute VB_Name = "SentItemsWatcher"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Option Explicit

' ================================================================
' SentItemsWatcher - CLASS MODULE (import rieng, khong phai standard
' module nhu CampaignTracker.bas)
'
' Nghe su kien Outlook.Items.ItemAdd tren Sent Items: NGAY KHI Outlook
' gui xong 1 mail va ban sao roi vao Sent Items, rut gon ban sao do lap
' tuc (thay body bang 1 dong placeholder + xoa attachments).
'
' VI SAO CAN: truoc day viec rut gon dua hoan toan vao 2 co che QUET
' DINH KY - quet moi 50 mail trong vong lap gui, va Windows Timer quet
' lai moi 60 giay. Ca hai deu co cung diem yeu: chung chay theo LICH
' chu khong theo SU KIEN, nen luon co do tre va luon phai quet lai ca
' thu muc Sent Items de tim xem co gi moi. Voi campaign hang nghin
' nguoi, ban sao (co the ~4MB/ban neu mail co anh nhung) don dap roi
' vao Sent Items suot NHIEU TIENG, va chi can rut gon khong theo kip la
' hop thu day -> Exchange CHAN gui -> dut ca dot gui giua chung.
'
' Watcher nay xu ly dung goc van de do: khong co do tre (rut gon ngay
' tai thoi diem mail vua den) va khong phai quet gi ca (Outlook dua
' thang item vao tay qua tham so cua su kien).
'
' VAN GIU cac co che quet dinh ky lam LUOI AN TOAN, khong bo:
'   - Outlook co gioi han da biet: ItemAdd co the KHONG kich hoat khi
'     nhieu item duoc them vao thu muc cung luc (thuong noi den nguong
'     ~16 item). Luc gui that thi mail roi vao Sent Items cach nhau
'     vai giay nen gan nhu khong dinh, nhung khong the loai tru.
'   - Sua/luu 1 item ngay khi no vua den doi khi bi Outlook tu choi.
'     Truong hop do o day se that bai lang le (On Error Resume Next) va
'     lan quet dinh ky sau se vet not.
'
' CACH IMPORT (VBA Editor - Alt+F11):
'   File > Import File... > chon file SentItemsWatcher.cls nay.
'   (Khac voi CampaignTracker.bas - .cls phai import nhu 1 class module
'   rieng, khong dan noi dung vao module thuong duoc.)
'
' CACH DUNG: khong goi truc tiep class nay - SendCampaign() va
' ShrinkNow() trong CampaignTracker.bas tu dong tao watcher.
'
' LUU Y: watcher chi song trong PHIEN Outlook hien tai. Neu dong/khoi
' dong lai Outlook giua chung, chay macro ShrinkNow (Alt+F8) 1 lan de
' bat lai - giong nhu voi Windows Timer.
' ================================================================

Public WithEvents SentItems As Outlook.Items
Attribute SentItems.VB_VarHelpID = -1

' Dieu kien nhan dien mail thuoc campaign dang theo doi. Dung CA HAI vi
' moi cai manh o mot hoan canh:
'   - Slug (UserProperty CMSlug): chinh xac tuyet doi, nhung co the chua
'     doc duoc ngay trong vai phut dau sau khi gui.
'   - KnownSubject: doc duoc TUC THI (thuoc tinh goc cua mail), la cach
'     duy nhat bat duoc mail vua moi den.
Public Slug As String
Public KnownSubject As String
Public PlaceholderHTML As String

Private Sub SentItems_ItemAdd(ByVal Item As Object)
    On Error Resume Next

    If Item.Class <> olMail Then Exit Sub

    Dim isMatch As Boolean: isMatch = False

    If Len(Slug) > 0 Then
        Dim s As String: s = ""
        s = Item.UserProperties("CMSlug").Value
        If s = Slug Then isMatch = True
    End If

    If Not isMatch And Len(KnownSubject) > 0 Then
        If Item.subject = KnownSubject Then isMatch = True
    End If

    If Not isMatch Then Exit Sub

    ' Rut gon: thay body bang placeholder NGAN va xoa toan bo attachments
    ' (ca file dinh kem that lan anh chen kieu Insert Picture - Outlook luu
    ' chung trong cung collection Attachments). Nguoi nhan DA nhan ban day
    ' du roi, day chi la ban luu cua nguoi gui.
    ' Giu nguyen Subject/To/Date va 2 UserProperties CMSlug/CMEID de
    ' RecallCampaign() van tim va thu hoi duoc binh thuong.
    Item.HTMLBody = PlaceholderHTML

    Dim a As Long
    For a = Item.Attachments.Count To 1 Step -1
        Item.Attachments.Remove a
    Next a

    Item.Save

    On Error GoTo 0
End Sub
