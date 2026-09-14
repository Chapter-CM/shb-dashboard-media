Option Explicit

' ================================================================
' SHB CM Campaign Tracker - Test Harness (TestHarness.bas) v1.0
'
' Muc dich: gia lap so luong lon mail trong Sent Items MA KHONG GUI
' THAT - khong SMTP, khong Recipients that, khong ton thoi gian mang -
' de test ShrinkCampaignSentItems()/SHRINK_EVERY/gioi han dung luong
' hop thu trong VAI GIAY thay vi phai gui that hang nghin mail va doi
' hang gio (van de nguoi dung gap phai khi test truoc day).
'
' AN TOAN: SeedFakeSentItems() KHONG BAO GIO goi .Send() - chi tao
' MailItem roi .Move() thang vao Sent Items, khong dinh danh nguoi
' nhan that nao. Dung de test rieng phan "dung luong hop thu" (Tang 2).
'
' Loi ve NOI DUNG (HTML rong, anh mat link, click tracking sai) KHONG
' test bang macro nay - test bang cach gui SendCampaign() that nhung
' chi 5-10 dia chi noi bo (Tang 1), vi loi loai do lo ra ngay o 1 mail,
' khong can quy mo lon.
'
' Cach dung nhanh:
'   1. Chay SeedFakeSentItems() -> nhap slug (vd "test-shrink-01"),
'      so luong (vd 500), kich thuoc file dinh kem KB (vd 2000 = ~2MB).
'   2. Mo Module1, chay thu ShrinkCampaignSentItems("test-shrink-01")
'      tu Immediate Window (Ctrl+G): ?ShrinkCampaignSentItems("test-shrink-01")
'      -> kiem tra so luong rut gon, kiem tra dung luong Sent Items
'      truoc/sau (chuot phai folder Sent Items -> Properties -> tab
'      General de xem dung luong).
'   3. Chay CleanupFakeSentItems() de xoa sach mail test, tranh de rac
'      lai trong hop thu that.
' ================================================================

Public Sub SeedFakeSentItems()
    Dim slug As String
    slug = InputBox("Slug test (khong dau, vd: test-shrink-01):", "Seed Fake Sent Items", "test-shrink-01")
    If Len(slug) = 0 Then Exit Sub

    Dim cntStr As String
    cntStr = InputBox("So luong mail gia lap (vd: 500):", "Seed Fake Sent Items", "500")
    If Len(cntStr) = 0 Or Not IsNumeric(cntStr) Then Exit Sub
    Dim cnt As Long: cnt = CLng(cntStr)
    If cnt <= 0 Then Exit Sub

    Dim sizeStr As String
    sizeStr = InputBox("Kich thuoc file dinh kem gia lap, KB (vd 2000 = ~2MB, giong mail that):", _
                        "Seed Fake Sent Items", "2000")
    If Len(sizeStr) = 0 Or Not IsNumeric(sizeStr) Then Exit Sub
    Dim sizeKB As Long: sizeKB = CLng(sizeStr)
    If sizeKB <= 0 Then Exit Sub

    If MsgBox("Sap tao " & cnt & " mail gia lap (~" & sizeKB & "KB dinh kem/mail = ~" & _
              Format(cnt * sizeKB / 1024, "0.0") & "MB tong) truc tiep vao Sent Items " & _
              "cua account mac dinh." & vbCrLf & vbCrLf & _
              "KHONG gui di dau, chi de test Shrink/dung luong. Tiep tuc?", _
              vbYesNo + vbQuestion, "Xac nhan Seed") <> vbYes Then Exit Sub

    ' Tao 1 file dummy tren dia lam attachment - noi dung khong quan
    ' trong, chi can dung dung luong can test.
    Dim dummyPath As String
    dummyPath = Environ("TEMP") & "\shb_test_dummy_attach.bin"
    CreateDummyFile dummyPath, sizeKB

    Dim sentFolder As folder
    Set sentFolder = Application.Session.GetDefaultFolder(olFolderSentMail)

    Dim i As Long
    For i = 1 To cnt
        Dim m As MailItem
        Set m = Application.CreateItem(olMailItem)
        m.Subject = "[TEST-SHRINK] " & slug & " #" & Format(i, "0000")
        m.HTMLBody = "<html><body>Fake test mail #" & i & " cho campaign gia lap '" & slug & "'." & _
                     " Mail nay KHONG duoc gui di dau, chi dung de test.</body></html>"
        m.Attachments.Add dummyPath
        m.UserProperties.Add "CMSlug", olText
        m.UserProperties("CMSlug").Value = slug
        m.UserProperties.Add "CMEID", olText
        m.UserProperties("CMEID").Value = "TEST" & Format(i, "0000")
        m.Save
        m.Move sentFolder
        Set m = Nothing
        If i Mod 100 = 0 Then DoEvents
    Next i

    On Error Resume Next
    Kill dummyPath
    On Error GoTo 0

    MsgBox "Da tao " & cnt & " mail gia lap (~" & sizeKB & "KB/mail) trong Sent Items." & vbCrLf & _
           "CMSlug = '" & slug & "'." & vbCrLf & vbCrLf & _
           "Buoc tiep theo: mo Immediate Window (Ctrl+G) trong VBA Editor, go:" & vbCrLf & _
           "  ?ShrinkCampaignSentItems(""" & slug & """)" & vbCrLf & _
           "roi kiem tra dung luong Sent Items truoc/sau (chuot phai folder -> Properties)." & vbCrLf & vbCrLf & _
           "Xong roi nho chay CleanupFakeSentItems() de don rac.", _
           vbInformation, "Seed xong"
End Sub

Private Sub CreateDummyFile(path As String, sizeKB As Long)
    Dim fnum As Integer: fnum = FreeFile
    Open path For Binary Access Write As #fnum
    Dim chunk(1 To 1024) As Byte
    Dim i As Long
    For i = 1 To sizeKB
        Put #fnum, , chunk
    Next i
    Close #fnum
End Sub

' Xoa toan bo mail test (theo CMSlug) khoi Sent Items sau khi test xong -
' tranh de rac lai trong hop thu that. Chi xoa mail co Subject bat dau
' bang "[TEST-SHRINK]" VA dung CMSlug - khong dung tham chieu subject
' rong de tranh xoa nham mail that.
Public Sub CleanupFakeSentItems()
    Dim slug As String
    slug = InputBox("Slug can xoa (vd: test-shrink-01):", "Cleanup Fake Sent Items")
    If Len(slug) = 0 Then Exit Sub

    Dim sentFolder As folder
    Set sentFolder = Application.Session.GetDefaultFolder(olFolderSentMail)

    Dim n As Long: n = 0
    Dim i As Long
    For i = sentFolder.Items.Count To 1 Step -1
        Dim itm As Object: Set itm = sentFolder.Items(i)
        If TypeName(itm) = "MailItem" Then
            If Left(itm.Subject, 14) = "[TEST-SHRINK]" Then
                Dim s As String: s = ""
                On Error Resume Next
                s = itm.UserProperties("CMSlug").Value
                On Error GoTo 0
                If s = slug Then
                    itm.Delete
                    n = n + 1
                End If
            End If
        End If
    Next i
    MsgBox "Da xoa " & n & " mail test co slug '" & slug & "'.", vbInformation, "Cleanup xong"
End Sub
