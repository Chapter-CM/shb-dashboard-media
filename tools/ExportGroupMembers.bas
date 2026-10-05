Option Explicit
' ================================================================
' XUAT THANH VIEN GROUP MAIL -> CSV (CHI DOC, khong gui mail, khong sua gi)
' Muc dich: lay danh sach thanh vien cua tung group mail de dashboard Email
' them tab "Group mail". File ket qua: group_mail_members.csv tren Desktop.
'
' DANH SACH GROUP: macro tu doc danh sach nam trong ham DefaultGroupList (65 group:
' chi nhanh + shbho + TrungTamKinhDoanh). Muon dung danh sach khac: tao file
' group_mail_list.txt tren Desktop (moi dong 1 group, ghi email hoac ten group) -
' co file nay thi macro dung file, bo qua danh sach co san.
' LUU Y: chay LAU (65 group, hon 6000 nguoi: co the 10-30 phut).
' Cu de Outlook chay, khong dong cua so. Tien do in o cua so Immediate (Ctrl+G).
' ================================================================
Private Const PR_SMTP As String = "http://schemas.microsoft.com/mapi/proptag/0x39FE001E"
Private mLines As Collection
Private mSeen As Object

Public Sub ExportGroupMailMembers()
    Dim entries() As String, i As Long, n As Long
    Dim addr As String, label As String, p1 As Long, p2 As Long, e As String
    Dim rcp As Recipient, bad As String, okList As String, before As Long

    entries = Split(LoadGroupList(), ";")
    n = UBound(entries) + 1
    If MsgBox("Se xuat " & n & " group mail. Co the mat 10-30 phut, trong luc do Outlook co the dung hinh (binh thuong). Bam OK de bat dau, khong dong Outlook cho den khi hien thong bao 'Da xuat xong'.", vbOKCancel + vbInformation, "Xuat group mail") = vbCancel Then Exit Sub

    Set mLines = New Collection
    mLines.Add "group,ten,email"

    On Error GoTo Fin
    For i = LBound(entries) To UBound(entries)
        e = Trim(Replace(Replace(entries(i), vbCr, ""), vbLf, ""))
        If Len(e) > 0 Then
            p1 = InStr(e, "<"): p2 = InStr(e, ">")
            If p1 > 0 And p2 > p1 Then addr = Trim(Mid(e, p1 + 1, p2 - p1 - 1)) Else addr = e
            If InStr(addr, "@") > 0 Then label = Left(addr, InStr(addr, "@") - 1) Else label = addr

            Debug.Print Format(Now, "hh:nn:ss") & "  " & (i + 1) & "/" & n & "  " & label
            DoEvents

            Set rcp = Application.Session.CreateRecipient(addr)
            rcp.Resolve
            If rcp.Resolved Then
                before = mLines.Count
                Set mSeen = CreateObject("Scripting.Dictionary")
                ExpandGroup rcp.AddressEntry, label, 0
                okList = okList & label & ": " & (mLines.Count - before) & vbCrLf
            Else
                bad = bad & label & vbCrLf
            End If
        End If
    Next i

Fin:
    If Err.Number <> 0 Then MsgBox "Dung giua chung do loi: " & Err.Description & vbCrLf & "Se luu phan da lay duoc.", vbExclamation
    On Error GoTo 0

    If mLines.Count <= 1 Then
        MsgBox "Khong lay duoc thanh vien nao." & vbCrLf & vbCrLf & "Khong tim thay group: " & vbCrLf & bad, vbExclamation, "Xuat group mail"
        Exit Sub
    End If

    Dim path As String
    path = SaveCsv()
    MsgBox "Da xuat xong: " & path & vbCrLf & "Tong " & (mLines.Count - 1) & " dong (group x thanh vien)." & vbCrLf & vbCrLf & _
           IIf(Len(bad) > 0, "KHONG tim thay: " & vbCrLf & bad & vbCrLf, "") & okList, vbInformation, "Xuat group mail"
End Sub

Private Function SaveCsv() As String
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
    SaveCsv = path
End Function

' Doc danh sach tu file group_mail_list.txt tren Desktop neu co, khong thi dung danh sach co san.
Private Function LoadGroupList() As String
    Dim p As String, fso As Object, ts As Object
    p = CreateObject("WScript.Shell").SpecialFolders("Desktop") & "\group_mail_list.txt"
    Set fso = CreateObject("Scripting.FileSystemObject")
    If fso.FileExists(p) Then
        Set ts = fso.OpenTextFile(p, 1)
        LoadGroupList = Replace(Replace(ts.ReadAll, vbCrLf, ";"), vbLf, ";")
        ts.Close
        Exit Function
    End If
    LoadGroupList = DefaultGroupList()
End Function

Private Function DefaultGroupList() As String
    Dim s As String
    s = s & "cnangiang@shb.com.vn;cnbacgiang@shb.com.vn;cnbacninh@shb.com.vn;cnbadinh@shb.com.vn;cnbentre@shb.com.vn;cnbinhdinh@shb.com.vn;cnbinhduong@shb.com.vn;cnbinhphuoc@shb.com.vn;cnbinhthuan@shb.com.vn;cncamau@shb.com.vn;cncantho@shb.com.vn;cndaklak@shb.com.vn;cndanang@shb.com.vn;cndongdo@shb.com.vn;cndongnai@shb.com.vn;cndongthap@shb.com.vn;cnkiengiang@shb.com.vn;cnkinhbac@shb.com.vn;cnkinhdo@shb.com.vn;cnkhanhhoa@shb.com.vn;cnlamdong@shb.com.vn;cnlangson@shb.com.vn;cnlaocai@shb.com.vn;cnlongan@shb.com.vn;cnnamdinh@shb.com.vn;cnninhbinh@shb.com.vn;cnnghean@shb.com.vn;cnphunhuan@shb.com.vn;"
    s = s & "cnphutho@shb.com.vn;cnquangbinh@shb.com.vn;cnquangnam@shb.com.vn;cnquangninh@shb.com.vn;cnquangngai@shb.com.vn;cnquangtri@shb.com.vn;cnsaigon@shb.com.vn;cnsoctrang@shb.com.vn;cnsonla@shb.com.vn;cntayhanoi@shb.com.vn;cntayninh@shb.com.vn;cntiengiang@shb.com.vn;cntuyenquang@shb.com.vn;cnthaibinh@shb.com.vn;cnthainguyen@shb.com.vn;cnthanglong@shb.com.vn;cnthanhhoa@shb.com.vn;cnthudo@shb.com.vn;cnvanphuc@shb.com.vn;cnvinhlong@shb.com.vn;cnvinhphuc@shb.com.vn;cnvungtau@shb.com.vn;cngialai@shb.com.vn;cnhadong@shb.com.vn;cnhaiduong@shb.com.vn;cnhaiphong@shb.com.vn;cnhanam@shb.com.vn;"
    s = s & "cnhanoi@shb.com.vn;cnhanthuyen@shb.com.vn;cnhatinh@shb.com.vn;cnhathanh@shb.com.vn;cnhoankiem@shb.com.vn;cnhochiminh@shb.com.vn;cnhue@shb.com.vn;cnhungyen@shb.com.vn;shbho@shb.com.vn;TrungTamKinhDoanh@shb.com.vn;"
    DefaultGroupList = s
End Function

' Bung group (ke ca group long nhau). grp = ten group cap tren cung. Moi nguoi chi ghi 1 lan / group.
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
            smtp = LCase(smtp)
            If Not mSeen.Exists(smtp) Then
                mSeen.Add smtp, 1
                mLines.Add Q(grp) & "," & Q(ae.Name) & "," & Q(smtp)
            End If
        End If
    End If
End Sub

Private Function Q(ByVal s As String) As String
    Q = """" & Replace(s, """", """""") & """"
End Function
