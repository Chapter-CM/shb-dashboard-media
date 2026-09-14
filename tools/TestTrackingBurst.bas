Option Explicit

' ================================================================
' SHB CM Campaign Tracker - Test Tracking Burst (TestTrackingBurst.bas) v1.0
'
' Muc dich: test rieng co che chong mat tracking "pos=sent" (fix v4.95 -
' m_Bag doi tu mang co dinh 400 cho sang mang dong) MA KHONG GUI BAT KY
' EMAIL NAO - chi ban thang HTTP GET "pos=sent" toi dung URL tracking
' that, voi 1 campaign slug ro rang la TEST, khong dinh danh nguoi nhan
' that nao. AN TOAN TUYET DOI VE SPAM vi khong co MailItem/Recipient nao
' duoc tao.
'
' Cach dung:
'   1. Alt+F8 -> chay TestTrackingBurst -> nhap so luong (vd 500, phai
'      LON HON 400 moi that su test duoc loi buffer cu).
'   2. Doi vai giay - vai chuc giay tuy mang.
'   3. Vao dashboard email, tim/loc campaign co ten
'      "TEST-BUFFER-FIX-KHONG-XOA-DUOC-TU-DONG" -> xem cot "Da gui".
'   4. Neu "Da gui" = dung bang so luong da nhap -> fix buffer dung.
'      Neu it hon -> con loi, bao lai de kiem tra tiep.
'
' LUU Y: he thong hien CHUA co API xoa du lieu tracking - campaign test
' nay se o lai vinh vien trong database. Da dat ten that ro de khong bi
' nham voi campaign that.
' ================================================================

Private Const TEST_TRACK_URL As String = "https://service.dev-saha.aws.shb.com.vn/public-api/api/track"
Private Const TEST_SLUG      As String = "TEST-BUFFER-FIX-KHONG-XOA-DUOC-TU-DONG"

Private m_TestBag() As Object
Private m_TestBagN As Long

Public Sub TestTrackingBurst()
    Dim cntStr As String
    cntStr = InputBox("So luong ping HTTP gia lap (vd: 500 - phai > 400 moi test duoc loi buffer cu):", _
                       "Test Tracking Burst", "500")
    If Len(cntStr) = 0 Or Not IsNumeric(cntStr) Then Exit Sub
    Dim cnt As Long: cnt = CLng(cntStr)
    If cnt <= 0 Then Exit Sub

    If MsgBox("Sap gui " & cnt & " ping HTTP toi TRACK_URL that, voi campaign = '" & TEST_SLUG & _
              "'." & vbCrLf & vbCrLf & _
              "KHONG tao/gui bat ky email nao - chi la HTTP GET request, an toan tuyet doi." & _
              vbCrLf & "Du lieu test se o lai trong database (chua co API xoa). Tiep tuc?", _
              vbYesNo + vbQuestion, "Xac nhan Test") <> vbYes Then Exit Sub

    ReDim m_TestBag(0 To cnt)
    m_TestBagN = 0

    Dim i As Long
    For i = 1 To cnt
        Dim eid As String: eid = "TESTBUF" & Format(i, "00000")
        Dim url As String
        url = TEST_TRACK_URL & "?pos=sent" & _
              "&eid=" & eid & _
              "&rcpt=" & "test%40example.invalid" & _
              "&campaign=" & TEST_SLUG & _
              "&squad=test&type=test&role=test&dept=test&loc=test"
        FireTestHttp url
        If i Mod 100 = 0 Then DoEvents
    Next i

    ' Doi vai giay de cac request async con dang bay kip hoan tat truoc
    ' khi thoat Sub (neu thoat qua som, cac object trong m_TestBag se bi
    ' giai phong khi Sub ket thuc, co the huy ngang request con dang gui).
    Dim tEnd As Date: tEnd = Now + TimeSerial(0, 0, 10)
    Do While Now < tEnd: DoEvents: Loop

    MsgBox "Da gui xong " & cnt & " ping test." & vbCrLf & vbCrLf & _
           "Vao dashboard email, tim campaign:" & vbCrLf & _
           TEST_SLUG & vbCrLf & vbCrLf & _
           "Xem cot 'Da gui' - neu = " & cnt & " la dung, fix buffer da hoat dong.", _
           vbInformation, "Test xong"
End Sub

Private Sub FireTestHttp(url As String)
    On Error Resume Next
    Dim h As Object
    Set h = CreateObject("MSXML2.XMLHTTP.6.0")
    If Not h Is Nothing Then
        h.Open "GET", url, True
        h.send
        If m_TestBagN <= UBound(m_TestBag) Then
            Set m_TestBag(m_TestBagN) = h
            m_TestBagN = m_TestBagN + 1
        End If
    End If
    On Error GoTo 0
End Sub
