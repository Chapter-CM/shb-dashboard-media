Attribute VB_Name = "ExportGroupMembers"
Option Explicit
' ================================================================
' XUAT THANH VIEN GROUP MAIL -> CSV (CHI DOC, khong gui mail, khong sua gi)
' Muc dich: lay danh sach thanh vien cua tung group mail de dashboard Email
' them tab "Group mail". File ket qua: group_mail_members.csv tren Desktop.
' Cach dung: xem huong dan trong cau tra loi (Alt+F11 > Import File > chay macro
' ExportGroupMailMembers).
' ================================================================
Private Const PR_SMTP As String = "http://schemas.microsoft.com/mapi/proptag/0x39FE001E"
Private mLines As Collection

Public Sub ExportGroupMailMembers()
    Dim s As String
    s = InputBox("Nhap ten hoac email cac group mail, cach nhau bang dau ; " & vbCrLf & _
                 "Vi du: SHB-KhoiNHS;TT Nang luc;khoikdv@shb.com.vn", "Xuat thanh vien group mail")
    If Len(Trim(s)) = 0 Then Exit Sub

    Set mLines = New Collection
    mLines.Add "group,ten,email"

    Dim parts() As String, i As Long, nm As String
    Dim rcp As Recipient, bad As String, okList As String, c As Long, before As Long
    parts = Split(s, ";")
    For i = LBound(parts) To UBound(parts)
        nm = Trim(parts(i))
        If Len(nm) > 0 Then
            Set rcp = Application.Session.CreateRecipient(nm)
            rcp.Resolve
            If rcp.Resolved Then
                before = mLines.Count
                ExpandGroup rcp.AddressEntry, nm, 0
                c = mLines.Count - before
                okList = okList & nm & ": " & c & " thanh vien" & vbCrLf
            Else
                bad = bad & nm & vbCrLf
            End If
        End If
    Next i

    If mLines.Count <= 1 Then
        MsgBox "Khong lay duoc thanh vien nao." & vbCrLf & vbCrLf & _
               "Khong tim thay group: " & vbCrLf & bad, vbExclamation, "Xuat group mail"
        Exit Sub
    End If

    Dim txt As String, ln As Variant
    For Each ln In mLines
        txt = txt & ln & vbCrLf
    Next ln

    Dim path As String
    path = CreateObject("WScript.Shell").SpecialFolders("Desktop") & "\group_mail_members.csv"
    Dim st As Object
    Set st = CreateObject("ADODB.Stream")
    st.Type = 2
    st.Charset = "utf-8"
    st.Open
    st.WriteText txt
    st.SaveToFile path, 2
    st.Close

    MsgBox "Da xuat xong: " & path & vbCrLf & vbCrLf & okList & _
           IIf(Len(bad) > 0, vbCrLf & "KHONG tim thay: " & vbCrLf & bad, ""), vbInformation, "Xuat group mail"
End Sub

' Bung group (ke ca group long nhau). grp = ten group cap tren cung ban nhap.
Private Sub ExpandGroup(ae As AddressEntry, grp As String, depth As Long)
    If ae Is Nothing Then Exit Sub
    If depth > 5 Then Exit Sub
    On Error Resume Next
    Dim mems As AddressEntries, m As AddressEntry
    Dim smtp As String, xu As ExchangeUser

    If ae.AddressEntryUserType = olExchangeDistributionListAddressEntry Then
        Set mems = ae.Members
        If Not mems Is Nothing Then
            For Each m In mems
                ExpandGroup m, grp, depth + 1
            Next m
        End If
    Else
        smtp = ""
        Set xu = ae.GetExchangeUser()
        If Not xu Is Nothing Then smtp = xu.PrimarySmtpAddress
        If InStr(smtp, "@") = 0 Then smtp = ae.PropertyAccessor.GetProperty(PR_SMTP)
        If InStr(smtp, "@") = 0 Then
            If InStr(ae.Address, "@") > 0 Then smtp = ae.Address
        End If
        If InStr(smtp, "@") > 0 Then
            mLines.Add Q(grp) & "," & Q(ae.Name) & "," & Q(LCase(smtp))
        End If
    End If
End Sub

Private Function Q(ByVal s As String) As String
    Q = """" & Replace(s, """", """""") & """"
End Function
