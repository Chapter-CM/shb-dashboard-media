Option Explicit

' ================================================================
' SHB CM Campaign Tracker v4.20
' Stack  : Outlook Classic Desktop/Mobile (VBA macro) -> /api/track public -> MySQL
'
' Nguon chinh thuc DUY NHAT cua macro nay la file trong repo shb-dashboard-media
' (repo email-tracker-data cu da nghi, khong dung nua - tranh update nham 2 noi).
'
' CHANGES vs v4.19
'   - Fix "Khong tim thay action 'Recall'": "Recall This Message" la lenh Ribbon
'     (Fluent UI idMso "RecallThisMessage"), KHONG nam trong MailItem.Actions
'     (chi co Reply/ReplyAll/Forward...) nen lan tim truoc luon that bai. Doi
'     sang itm.Display() de mo cua so mail can recall, roi goi lenh qua
'     Inspector.CommandBars.ExecuteMso("RecallThisMessage"). Dong cua so lai
'     sau khi xu ly xong (olDiscard) de khong lam tran man hinh voi 3000 cua so.
'
' CHANGES vs v4.18
'   - RecallCampaign bao "Loi: 1" nhung khong noi ro tai sao. Them errMsg ByRef
'     vao RecallOneItem() de bat Err.Number/Description that su, hien trong
'     MsgBox "Chi tiet loi" cuoi cung - giong cach DoFullMode da lam voi loi gui.
'
' CHANGES vs v4.17
'   - Fix RecallCampaign khong tim thay mail: SendCampaign luu CMSlug qua
'     MakeSlug() (ascii-lowercase-gach-ngang), nhung RecallCampaign truoc do so
'     khop y nguyen chuoi nguoi dung go (co dau/hoa/khoang trang) nen khong bao
'     gio trung. Gio RecallCampaign tu chay slug nguoi dung nhap qua MakeSlug()
'     truoc khi so khop - go ten chien dich nguyen ban hay slug deu duoc.
'
' CHANGES vs v4.16
'   - Fix "Khong tim thay cua so mail dang mo" trong RecallCampaign kieu replace:
'     MsgBox huong dan la modal nen nguoi dung khong the mo cua so mail moi giua
'     luc macro dang chay. Gio yeu cau mo + soan san mail thay the TRUOC khi chay
'     macro (Ctrl+N, giu mo), macro bat ActiveInspector ngay dau Sub (truoc moi
'     InputBox/MsgBox khac) roi moi hoi slug/kieu recall.
'
' CHANGES vs v4.15
'   - RecallCampaign() kieu "replace": bo InputBox plain-text, gio lay noi dung
'     thay the tu 1 cua so mail dang mo (soan day du dinh dang/chen anh nhu binh
'     thuong qua ribbon Outlook, giong het cach SendCampaign lay draft dang soan)
'     - macro doc Subject + HTMLBody tu cua so do va ap dung cho ca 3000 mail
'     thay the tu dong, khong can bam tay tung cai.
'
' CHANGES vs v4.14
'   - RecallCampaign() kieu "replace": truoc chi bam OK dialog voi noi dung
'     mac dinh cua Outlook. Gio hoi Subject + Body thay the 1 LAN cho ca
'     campaign truoc khi chay batch, roi voi tung mail se tu lay cua so soan
'     thu thay the ma Outlook mo ra (qua ActiveInspector), ghi de dung
'     Subject/Body do va tu Send - khong can bam tay tung cai trong 3000 mail.
'
' CHANGES vs v4.13
'   - Fix "You don't have appropriate permission to perform this operation"
'     (#-2147024891) khi gui Full mode: SaveSentMessageFolder vao folder con tu
'     tao duoi Inbox bi Exchange chan (policy noi bo). Bo han buoc tao folder
'     rieng - gio moi mail sau khi gui duoc luu vao Sent Items MAC DINH (chi bo
'     DeleteAfterSubmit, khong doi noi luu), van giu UserProperties CMSlug/CMEID
'     de RecallCampaign() loc lai dung campaign trong Sent Items.
'
' CHANGES vs v4.12
'   - Van de: Full mode gui 3000 mail rieng (1 mail/nguoi) voi DeleteAfterSubmit=True
'     -> khong luu ban copy nao ca -> KHONG THE Recall vi khong co gi de mo ra bam
'     Recall. Neu muon Recall phai lam thu cong tung mail rat mat cong voi so luong lon.
'   - Fix: DeleteAfterSubmit bo di de Outlook tu luu ban copy vao Sent Items, kem
'     UserProperties CMSlug / CMEID de sau nay loc lai dung campaign.
'   - Them macro moi RecallCampaign(): nhap slug campaign can recall, chon kieu
'     (giong 2 lua chon cua Outlook: "Delete unread copies" hoac "Delete unread
'     copies and replace with a new message"), roi tu dong loop toan bo mail cua
'     campaign do trong Sent Items va thuc hien recall cho tung cai - khong phai
'     mo tay tung mail nua.
'   - LUU Y: Outlook khong co API "recall am tham" khong dialog trong Object Model
'     chuan. RecallCampaign dung Actions("Recall-This-Message(C)").Execute + SendKeys
'     de tu dong bam dialog xac nhan cho tung mail. Cach nay hoat dong tot nhung van
'     phu thuoc UI dialog cua Outlook (locale/version) - da test tren Outlook Desktop
'     VN. Recall chi thanh cong voi nguoi nhan noi bo Exchange, dung Outlook Desktop,
'     va CHUA doc mail - day la gioi han cua Exchange, khong phai cua macro nay.
'
' CHANGES vs v4.11
'   - Doi TRACK_URL sang Ingress public rieng (anh Nam tao 15/07):
'       https://service.dev-saha.aws.shb.com.vn/public-api/api/track
'     Ly do: domain noi bo cu (cm-dashboard.dev-saha.aws.shb.com.vn) chi mang NHS
'     goi toi duoc - Outlook Mobile/WiFi thuong/VPN split-tunnel deu KHONG ghi nhan
'     duoc pixel (phat hien khi test tay 14/07). Domain moi la Ingress internet-facing
'     rieng, chi route dung path /api/track sang cung Service cm-dashboard-ingest,
'     khong dung dashboard/api/ingest/DB. Dich ghi du lieu (ingest-server.js/MySQL)
'     khong doi gi.
'
' CHANGES vs v4.9/4.10
'   - Fix "Khong tim thay dia chi email hop le" voi nguoi nhan GAL/contact:
'       ExpandEntry them nhieu fallback lay SMTP - PR_SMTP_ADDRESS, PR_EMAIL_ADDRESS,
'       Contact.Email1Address, ae.Address. Truoc chi lay qua GetExchangeUser().
'   - Thong bao loi gio LIET KE nguoi nhan khong resolve duoc + type/addr de chan doan.
'
' CHANGES vs v4.8
'   - Doi TRACK_URL sang endpoint noi bo SHB:
'       https://cm-dashboard.dev-saha.aws.shb.com.vn/api/track
'     (truoc do la project GOP tren Vercel: https://shb-fb-dashboard.vercel.app/api/track)
'     Ghi qua API ingest noi bo (cm-dashboard-ingest) vao MySQL noi bo SHB.
'
' CHANGES vs v4.6
'   - Fix pos=sent not in Supabase:
'       FireHttp async=True drops request before completion.
'       FireHttpSync uses async=False, blocks until server ACKs.
'   - Fix pos=top pixel not firing:
'       m.HTMLBody setter goes through Outlook HTML pipeline which
'       strips display:none tracking pixels. v4.7b uses m.HTMLBody setter
'       (reliable on SHB environment) + synchronous FireHttp.
'   - No Application.StatusBar anywhere (Error 438 in Outlook).
'   - InputBox for all campaign metadata (encoding safe).
'   - draft.Copy retained (preserves CID inline images).
' ================================================================

Private Const TRACK_URL As String = "https://service.dev-saha.aws.shb.com.vn/public-api/api/track"
Private Const VER       As String = "4.20"
Private Const PH_EID    As String = "[[XEID9F2A]]"
Private Const PH_RCPT   As String = "[[XRCP7B4C]]"

Private m_Bag(0 To 399) As Object
Private m_BagN           As Long

' ================================================================
' PUBLIC: SendCampaign
' ================================================================
Public Sub SendCampaign()

    Dim insp As Object
    Set insp = Application.ActiveInspector
    If insp Is Nothing Then
        MsgBox "Mo cua so email truoc khi gui.", vbExclamation, "SHB Tracker v" & VER
        Exit Sub
    End If

    Dim raw As Object
    On Error Resume Next
    Set raw = insp.CurrentItem
    On Error GoTo 0

    If raw Is Nothing Or raw.Class <> olMail Then
        MsgBox "Khong tim thay email dang soan.", vbExclamation, "SHB Tracker v" & VER
        Exit Sub
    End If
    Dim draft As MailItem: Set draft = raw

    ' Campaign metadata via InputBox
    Dim campName As String, squad As String, mType As String, prevTxt As String

    campName = InputBox("Ten chien dich (ASCII, vd: dao-tao-q3-2026):", _
                        "SHB Tracker 1/4", Trim(draft.subject))
    If Len(Trim(campName)) = 0 Then Exit Sub
    campName = Trim(campName)

    squad = InputBox("Squad / Du an (vd: nhan-su, cong-nghe):", _
                     "SHB Tracker 2/4", "default")
    If Len(Trim(squad)) = 0 Then squad = "default"
    squad = Trim(squad)

    mType = InputBox("Loai email (info / alert / training / policy):", _
                     "SHB Tracker 3/4", "info")
    If Len(Trim(mType)) = 0 Then mType = "info"
    mType = Trim(mType)

    ' Preview text: doc tu dong dau email body
    prevTxt = Trim(draft.body)
    Dim nlPos As Long
    nlPos = InStr(prevTxt, vbCrLf)
    If nlPos = 0 Then nlPos = InStr(prevTxt, vbLf)
    If nlPos = 0 Then nlPos = InStr(prevTxt, vbCr)
    If nlPos > 0 Then prevTxt = Trim(Left(prevTxt, nlPos - 1))
    If Len(prevTxt) > 120 Then prevTxt = Left(prevTxt, 120)
    If Len(Trim(prevTxt)) = 0 Then prevTxt = "(trong)"

    Dim slug As String: slug = MakeSlug(campName)

    Dim mAns As Integer
    mAns = MsgBox("Chon che do gui:" & vbCrLf & vbCrLf & _
                  "YES = Day du (ca nhan) - 1 email/nguoi" & vbCrLf & _
                  "NO  = Nhanh - 1 email toi toan bo nhom", _
                  vbYesNoCancel + vbQuestion, "SHB Tracker v" & VER)
    If mAns = vbCancel Then Exit Sub
    Dim fullMode As Boolean: fullMode = (mAns = vbYes)

    Dim doClick As Boolean
    doClick = (MsgBox("Bat click tracking?", vbYesNo + vbQuestion, "SHB Tracker") = vbYes)

    Dim eid0 As String
    eid0 = Format(Now, "yyMMddHHmm") & Format((CLng(Timer * 100) Mod 9000) + 1000, "0000")

    Dim modeStr As String
    If fullMode Then
        modeStr = "Day du (ca nhan) - 1 email/nguoi"
    Else
        modeStr = "Nhanh - 1 email toi nhom"
    End If

    Dim cm As String
    cm = "XAC NHAN GUI CHIEN DICH" & vbCrLf & String(32, "-") & vbCrLf & _
         "Che do      : " & modeStr & vbCrLf & _
         "Chien dich  : " & campName & vbCrLf & _
         "Slug (DB)   : " & slug & vbCrLf & _
         "Squad/Du an : " & squad & vbCrLf & _
         "Loai        : " & mType & vbCrLf & _
         "Preview text: " & Left(prevTxt, 60) & vbCrLf & _
         "Click track : " & IIf(doClick, "Bat", "Tat") & vbCrLf & _
         String(32, "-") & vbCrLf & "Tiep tuc?"
    If MsgBox(cm, vbYesNo + vbQuestion, "SHB Tracker") = vbNo Then Exit Sub

    m_BagN = 0
    If fullMode Then
        DoFullMode draft, campName, slug, squad, mType, eid0, doClick, prevTxt
    Else
        DoFastMode draft, slug, squad, mType, eid0
    End If
End Sub


' ================================================================
' FULL MODE
' ================================================================
Private Sub DoFullMode(draft As MailItem, campName As String, slug As String, _
                        squad As String, mType As String, eid0 As String, _
                        doClick As Boolean, prevTxt As String)

    Dim lst() As String: ReDim lst(0 To 4999)
    Dim nLst As Long: nLst = 0

    Dim rcp As Recipient
    Dim diag As String: diag = ""
    For Each rcp In draft.Recipients
        Dim before As Long: before = nLst
        ExpandEntry rcp.AddressEntry, lst, nLst
        If nLst = before Then
            ' Recipient nay khong resolve duoc SMTP -> ghi lai de chan doan
            Dim tInfo As String: tInfo = "?"
            On Error Resume Next
            tInfo = "type=" & rcp.AddressEntry.AddressEntryUserType & " | addr=" & Left(rcp.AddressEntry.Address, 60)
            On Error GoTo 0
            diag = diag & vbCrLf & "  - " & rcp.Name & "  [" & tInfo & "]"
        End If
    Next rcp

    If nLst = 0 Then
        MsgBox "Khong tim thay dia chi email hop le." & vbCrLf & vbCrLf & _
               "Nguoi nhan khong lay duoc SMTP:" & diag, vbExclamation, "SHB Tracker"
        Exit Sub
    End If

    Dim baseHTML As String: baseHTML = draft.HTMLBody

    ' Inject preview text as hidden preheader
    If Len(prevTxt) > 0 And prevTxt <> "(trong)" Then
        Dim preHdr As String
        preHdr = "<div style=""display:none;max-height:0;overflow:hidden;mso-hide:all;" & _
                 "font-size:1px;color:#ffffff;line-height:1px;"">" & prevTxt & "</div>"
        Dim btPos As Long: btPos = InStr(LCase(baseHTML), "<body")
        If btPos > 0 Then
            Dim btEnd As Long: btEnd = InStr(btPos, baseHTML, ">")
            If btEnd > 0 Then
                baseHTML = Left(baseHTML, btEnd) & preHdr & mid(baseHTML, btEnd + 1)
            End If
        Else
            baseHTML = preHdr & baseHTML
        End If
    End If

    If doClick Then baseHTML = WrapLinks(baseHTML, slug, squad, mType)

    Dim sentOK As Long:   sentOK = 0
    Dim sentFail As Long: sentFail = 0
    Dim failDiag As String: failDiag = ""
    Const BATCH As Long = 50

    Dim i As Long
    For i = 0 To nLst - 1
        ' Parse combined entry: smtp~role~dept~loc
        Dim entry() As String: entry = Split(lst(i), "~")
        Dim rcpt As String: rcpt = entry(0)
        If Len(rcpt) = 0 Then GoTo NextPerson
        Dim eRole As String: eRole = IIf(UBound(entry) >= 1, entry(1), "")
        Dim eDept As String: eDept = IIf(UBound(entry) >= 2, entry(2), "")
        Dim eLoc  As String: eLoc = IIf(UBound(entry) >= 3, entry(3), "")

        Dim eid As String: eid = eid0 & Format(i, "0000")

        Dim pxURL As String
        pxURL = TRACK_URL & "?pos=top" & _
                "&eid=" & eid & _
                "&rcpt=" & UrlEnc(rcpt) & _
                "&campaign=" & UrlEnc(slug) & _
                "&squad=" & UrlEnc(squad) & _
                "&type=" & UrlEnc(mType) & _
                "&role=" & UrlEnc(eRole) & _
                "&dept=" & UrlEnc(eDept) & _
                "&loc=" & UrlEnc(eLoc)
        Dim pxTag As String
        pxTag = "<img src=" & Chr(34) & pxURL & Chr(34) & _
                " width=" & Chr(34) & "1" & Chr(34) & _
                " height=" & Chr(34) & "1" & Chr(34) & _
                " style=" & Chr(34) & "display:none" & Chr(34) & _
                " border=" & Chr(34) & "0" & Chr(34) & _
                " alt=" & Chr(34) & Chr(34) & "/>"

        Dim thisHTML As String: thisHTML = baseHTML
        If doClick Then
            thisHTML = Replace(thisHTML, PH_EID, eid)
            thisHTML = Replace(thisHTML, PH_RCPT, UrlEnc(rcpt))
        End If
        Dim bp As Long: bp = InStr(LCase(thisHTML), "</body>")
        If bp > 0 Then
            thisHTML = Left(thisHTML, bp - 1) & pxTag & mid(thisHTML, bp)
        Else
            thisHTML = thisHTML & pxTag
        End If

        Dim m As MailItem
        On Error GoTo FailItem

        Set m = draft.Copy

        Dim j As Long
        For j = m.Recipients.Count To 1 Step -1
            m.Recipients.Item(j).Delete
        Next j

        m.Recipients.Add rcpt
        m.HTMLBody = thisHTML

        ' Tag campaign info truc tiep vao mail de RecallCampaign() loc lai duoc sau nay
        m.UserProperties.Add "CMSlug", olText
        m.UserProperties("CMSlug").Value = slug
        m.UserProperties.Add "CMEID", olText
        m.UserProperties("CMEID").Value = eid

        m.DeleteAfterSubmit = False
        m.send
        Set m = Nothing
        sentOK = sentOK + 1

        On Error GoTo 0

        ' pos=sent: async fire-and-forget
        FireHttp TRACK_URL & "?pos=sent" & _
                 "&eid=" & eid & _
                 "&rcpt=" & UrlEnc(rcpt) & _
                 "&campaign=" & UrlEnc(slug) & _
                 "&squad=" & UrlEnc(squad) & _
                 "&type=" & UrlEnc(mType) & _
                 "&role=" & UrlEnc(eRole) & _
                 "&dept=" & UrlEnc(eDept) & _
                 "&loc=" & UrlEnc(eLoc)

        DoEvents

        If (i + 1) Mod BATCH = 0 And i < nLst - 1 Then
            Dim tEnd As Date: tEnd = Now + TimeSerial(0, 0, 2)
            Do While Now < tEnd: DoEvents: Loop
        End If

        GoTo NextPerson

FailItem:
        sentFail = sentFail + 1
        If Len(failDiag) < 1000 Then
            failDiag = failDiag & vbCrLf & "  - " & rcpt & ": #" & Err.Number & " " & Err.Description
        End If
        On Error Resume Next
        If Not m Is Nothing Then m.Delete
        Set m = Nothing
        On Error GoTo 0
        Resume NextPerson

NextPerson:
    Next i

    ' Flush: wait 3s for async HTTP requests to complete
    Dim flushEnd As Date: flushEnd = Now + TimeSerial(0, 0, 3)
    Do While Now < flushEnd: DoEvents: Loop

    Dim doneMsg As String
    doneMsg = "Hoan thanh!" & vbCrLf & "Thanh cong: " & sentOK & vbCrLf & "Loi: " & sentFail
    If sentFail > 0 Then doneMsg = doneMsg & vbCrLf & vbCrLf & "Chi tiet loi:" & failDiag
    MsgBox doneMsg, vbInformation, "SHB Tracker v" & VER
End Sub


' ================================================================
' FAST MODE
' ================================================================
Private Sub DoFastMode(draft As MailItem, slug As String, squad As String, _
                        mType As String, eid0 As String)
    FireHttpSync TRACK_URL & "?pos=sent" & _
                 "&eid=" & eid0 & "0000" & _
                 "&rcpt=" & UrlEnc("dl") & _
                 "&campaign=" & UrlEnc(slug) & _
                 "&squad=" & UrlEnc(squad) & _
                 "&type=" & UrlEnc(mType)
    draft.send
    MsgBox "Da gui (Nhanh).", vbInformation, "SHB Tracker v" & VER
End Sub


' ================================================================
' EXPAND ADDRESS ENTRY
' ================================================================
Private Sub ExpandEntry(ae As AddressEntry, ByRef lst() As String, ByRef n As Long)
    If ae Is Nothing Then Exit Sub
    On Error Resume Next

    If ae.AddressEntryUserType = olExchangeDistributionListAddressEntry Then
        Dim mems As AddressEntries: Set mems = ae.Members
        If Not mems Is Nothing Then
            Dim mem As AddressEntry
            For Each mem In mems
                ExpandEntry mem, lst, n
            Next mem
        End If
    Else
        Dim smtp As String: smtp = ""
        Dim dispName As String: dispName = ae.Name
        Dim xu As ExchangeUser: Set xu = ae.GetExchangeUser()
        If Not xu Is Nothing Then
            smtp = xu.PrimarySmtpAddress
            If Len(Trim(dispName)) = 0 Then dispName = xu.Name
        ElseIf ae.AddressEntryUserType = olSmtpAddressEntry Then
            smtp = ae.Address
        End If
        ' Fallback 1: PR_SMTP_ADDRESS qua PropertyAccessor (GAL / hau het entry Exchange)
        If InStr(smtp, "@") = 0 Then
            smtp = ""
            smtp = ae.PropertyAccessor.GetProperty("http://schemas.microsoft.com/mapi/proptag/0x39FE001E")
        End If
        ' Fallback 1b: PR_EMAIL_ADDRESS (one-off / contact doi khi chua SMTP o day)
        If InStr(smtp, "@") = 0 Then
            Dim e2 As String: e2 = ""
            e2 = ae.PropertyAccessor.GetProperty("http://schemas.microsoft.com/mapi/proptag/0x3003001E")
            If InStr(e2, "@") > 0 Then smtp = e2
        End If
        ' Fallback 2: Contact ca nhan -> Email1Address
        If InStr(smtp, "@") = 0 Then
            Dim ct As Object: Set ct = Nothing
            Set ct = ae.GetContact()
            If Not ct Is Nothing Then smtp = ct.Email1Address
        End If
        ' Fallback 3: ae.Address neu ban than da la SMTP
        If InStr(smtp, "@") = 0 Then
            If InStr(ae.Address, "@") > 0 Then smtp = ae.Address
        End If
        smtp = LCase(Trim(smtp))
        If Len(smtp) > 5 And InStr(smtp, "@") > 0 Then
            ' Dedup by SMTP
            Dim k As Long
            For k = 0 To n - 1
                If Split(lst(k), "~")(0) = smtp Then GoTo AlreadyIn
            Next k
            If n > UBound(lst) Then ReDim Preserve lst(0 To n + 999)
            ' Parse display name: "Ten (Role - Dept - Loc)"
            Dim role As String: role = ""
            Dim dept As String: dept = ""
            Dim loc  As String: loc = ""
            Dim p1 As Long: p1 = InStr(dispName, "(")
            Dim p2 As Long: p2 = InStr(dispName, ")")
            If p1 > 0 And p2 > p1 Then
                Dim inner As String: inner = Trim(mid(dispName, p1 + 1, p2 - p1 - 1))
                inner = Replace(inner, " " & Chr(8211) & " ", " - ")
                Dim parts() As String: parts = Split(inner, " - ", 3)
                If UBound(parts) >= 0 Then role = Trim(parts(0))
                If UBound(parts) >= 1 Then dept = Trim(parts(1))
                If UBound(parts) >= 2 Then loc = Trim(parts(2))
            End If
            ' Store as "smtp~role~dept~loc"
            lst(n) = smtp & "~" & role & "~" & dept & "~" & loc
            n = n + 1
        End If
    End If

AlreadyIn:
    On Error GoTo 0
End Sub


' ================================================================
' WRAP LINKS
' ================================================================
Private Function WrapLinks(html As String, slug As String, _
                             squad As String, mType As String) As String
    Dim res As String: res = html
    Dim pos As Long:   pos = 1

    Do
        Dim hs As Long: hs = InStr(pos, LCase(res), "href=" & Chr(34))
        If hs = 0 Then Exit Do
        hs = hs + 6
        Dim he As Long: he = InStr(hs, res, Chr(34))
        If he = 0 Then Exit Do
        Dim orig As String: orig = mid(res, hs, he - hs)

        If Left(LCase(orig), 4) <> "http" Or InStr(LCase(orig), "api/track") > 0 Then
            pos = he + 1
        Else
            If Len(orig) > 480 Then orig = Left(orig, 480)
            Dim tURL As String
            tURL = TRACK_URL & "?pos=click" & _
                   "&eid=" & PH_EID & _
                   "&rcpt=" & PH_RCPT & _
                   "&campaign=" & UrlEnc(slug) & _
                   "&squad=" & UrlEnc(squad) & _
                   "&type=" & UrlEnc(mType) & _
                   "&url=" & UrlEnc(orig)
            res = Left(res, hs - 1) & tURL & mid(res, he)
            pos = hs + Len(tURL) + 1
        End If
    Loop

    WrapLinks = res
End Function


' ================================================================
' FIRE HTTP - async fire-and-forget (WinInet, SHB proxy compatible)
' m_Bag keeps object references alive until overwritten.
' ================================================================
Private Sub FireHttp(url As String)
    On Error Resume Next
    Dim h As Object
    Set h = CreateObject("MSXML2.XMLHTTP.6.0")
    If Not h Is Nothing Then
        h.Open "GET", url, True   ' True = async
        h.send
        Set m_Bag(m_BagN Mod 400) = h
        m_BagN = m_BagN + 1
    End If
    On Error GoTo 0
End Sub


' ================================================================
' FIRE HTTP SYNC - blocking, used for pos=sent in Fast Mode
' ================================================================
Private Sub FireHttpSync(url As String)
    On Error Resume Next
    Dim h As Object
    Set h = CreateObject("MSXML2.XMLHTTP.6.0")
    If Not h Is Nothing Then
        h.Open "GET", url, False  ' False = sync
        h.send
    End If
    On Error GoTo 0
End Sub


' ================================================================
' URL ENCODE - UTF-8 via ADODB.Stream
' ================================================================
Private Function UrlEnc(s As String) As String
    If Len(s) = 0 Then UrlEnc = "": Exit Function
    On Error GoTo FallbackEnc

    Dim stm As Object: Set stm = CreateObject("ADODB.Stream")
    stm.Open
    stm.Type = 2: stm.Charset = "UTF-8"
    stm.WriteText s
    stm.Position = 0
    stm.Type = 1
    Dim rawB() As Byte: rawB = stm.Read
    stm.Close: Set stm = Nothing

    ' Detect and skip UTF-8 BOM (EF BB BF = 239 187 191) if present
    Dim bStart As Long: bStart = 0
    If UBound(rawB) >= 2 Then
        If rawB(0) = 239 And rawB(1) = 187 And rawB(2) = 191 Then bStart = 3
    End If

    Dim r As String: r = ""
    Dim bi As Long
    For bi = bStart To UBound(rawB)
        Dim b As Long: b = rawB(bi)
        If (b >= 65 And b <= 90) Or (b >= 97 And b <= 122) Or (b >= 48 And b <= 57) Then
            r = r & Chr(b)
        ElseIf b = 45 Or b = 95 Or b = 46 Or b = 126 Then
            r = r & Chr(b)
        Else
            r = r & "%" & UCase(Right("0" & Hex(b), 2))
        End If
    Next bi
    UrlEnc = r
    Exit Function

FallbackEnc:
    ' ADODB unavailable - ASCII-safe fallback
    ' 2-char hex for all chars: @ (64=0x40) -> %40, NOT %0040
    On Error GoTo 0
    Dim r2 As String: r2 = ""
    Dim fi As Long
    For fi = 1 To Len(s)
        Dim cw As Long: cw = AscW(mid(s, fi, 1))
        If (cw >= 65 And cw <= 90) Or (cw >= 97 And cw <= 122) Or (cw >= 48 And cw <= 57) Then
            r2 = r2 & Chr(cw)
        ElseIf cw = 45 Or cw = 95 Or cw = 46 Or cw = 126 Then
            r2 = r2 & Chr(cw)
        ElseIf cw <= 127 Then
            ' ASCII: 2-char hex - e.g. @ (64=0x40) -> %40
            r2 = r2 & "%" & UCase(Right("0" & Hex(cw), 2))
        Else
            ' Non-ASCII: encode low byte (best effort without UTF-8 stream)
            r2 = r2 & "%" & UCase(Right("0" & Hex(cw And 255), 2))
        End If
    Next fi
    UrlEnc = r2
End Function


' ================================================================
' MAKE SLUG - ASCII only
' ================================================================
Private Function MakeSlug(s As String) As String
    Dim res As String: res = ""
    Dim ph As Boolean: ph = False
    Dim i As Long
    For i = 1 To Len(s)
        Dim cw As Long: cw = AscW(LCase(mid(s, i, 1)))
        If (cw >= 97 And cw <= 122) Or (cw >= 48 And cw <= 57) Then
            res = res & Chr(cw): ph = False
        ElseIf cw = 32 Or cw = 45 Or cw = 95 Then
            If Not ph And Len(res) > 0 Then res = res & "-": ph = True
        End If
    Next i
    Do While Len(res) > 0 And Right(res, 1) = "-": res = Left(res, Len(res) - 1): Loop
    If Len(res) = 0 Then res = "campaign"
    MakeSlug = res
End Function


' ================================================================
' PUBLIC: RecallCampaign
' Tu dong recall toan bo mail cua 1 campaign (theo slug) da gui qua
' Full mode, thay vi phai mo tay tung mail trong 3000 mail.
'
' Gioi han (do Exchange, khong phai do macro):
'   - Chi recall duoc mail gui noi bo cung to chuc Exchange.
'   - Nguoi nhan phai dang dung Outlook Desktop (khong phai Web/Mobile).
'   - Mail phai CHUA duoc mo doc.
' ================================================================
Public Sub RecallCampaign()

    ' Neu muon dung kieu "replace": TRUOC KHI chay macro nay, hay mo san 1 cua so
    ' mail moi (Ctrl+N), soan day du noi dung thay the (dinh dang/chen anh binh
    ' thuong), va GIU cua so do dang mo (khong can dong) - roi moi chay macro.
    ' MsgBox cua VBA la modal nen khong the mo cua so mail giua luc macro dang chay.

    Dim preOpenDraft As Object
    On Error Resume Next
    Set preOpenDraft = Application.ActiveInspector.CurrentItem
    On Error GoTo 0

    Dim slugRaw As String
    slugRaw = InputBox("Nhap ten/slug campaign can Recall (xem trong MsgBox xac nhan luc gui - " & _
                       "co the nhap y nguyen ten chien dich hoac slug, vd: dao-tao-q3-2026):", _
                       "SHB Tracker - Recall")
    If Len(Trim(slugRaw)) = 0 Then Exit Sub
    Dim slug As String: slug = MakeSlug(Trim(slugRaw))

    Dim modeAns As Integer
    modeAns = MsgBox("Chon kieu Recall cho campaign '" & slug & "':" & vbCrLf & vbCrLf & _
                     "YES = Delete unread copies of this message" & vbCrLf & _
                     "NO  = Delete unread copies AND replace with a new message" & vbCrLf & _
                     "  (can mail thay the da soan san va DANG MO truoc khi chay macro)" & vbCrLf & _
                     "CANCEL = Huy", vbYesNoCancel + vbQuestion, "SHB Tracker - Recall")
    If modeAns = vbCancel Then Exit Sub
    Dim doReplace As Boolean: doReplace = (modeAns = vbNo)

    Dim replSubject As String, replHTML As String
    If doReplace Then
        ' Lay noi dung thay the tu cua so mail da mo san TRUOC khi chay macro
        ' (bat duoc luc dau Sub, truoc khi cac InputBox/MsgBox lam mat active window).
        Dim replDraft As Object
        Set replDraft = preOpenDraft
        If replDraft Is Nothing Or replDraft.Class <> olMail Then
            MsgBox "Chua tim thay mail thay the dang mo." & vbCrLf & vbCrLf & _
                   "Hay mo 1 cua so mail moi (Ctrl+N), soan day du noi dung thay the, " & _
                   "GIU cua so do dang mo, roi CHAY LAI macro RecallCampaign() tu dau.", _
                   vbExclamation, "SHB Tracker - Recall"
            Exit Sub
        End If

        replSubject = replDraft.Subject
        replHTML = replDraft.HTMLBody
        If Len(Trim(replSubject)) = 0 Then
            MsgBox "Mail thay the chua co Subject.", vbExclamation, "SHB Tracker - Recall"
            Exit Sub
        End If
    End If

    Dim sentFolder As folder
    Set sentFolder = Application.Session.GetDefaultFolder(olFolderSentMail)
    If sentFolder Is Nothing Then
        MsgBox "Khong tim thay folder Sent Items.", vbExclamation, "SHB Tracker - Recall"
        Exit Sub
    End If

    Dim matched As Long: matched = 0
    Dim recalled As Long: recalled = 0
    Dim failed As Long: failed = 0
    Dim failDiag As String: failDiag = ""

    Dim itm As Object
    Dim i As Long
    For i = sentFolder.Items.Count To 1 Step -1
        Set itm = sentFolder.Items(i)
        If TypeName(itm) = "MailItem" Then
            Dim itmSlug As String: itmSlug = ""
            On Error Resume Next
            itmSlug = itm.UserProperties("CMSlug").Value
            On Error GoTo 0
            If itmSlug = slug Then
                matched = matched + 1
                Dim itmErr As String: itmErr = ""
                If RecallOneItem(itm, doReplace, replSubject, replHTML, itmErr) Then
                    recalled = recalled + 1
                Else
                    failed = failed + 1
                    If Len(failDiag) < 1000 Then
                        failDiag = failDiag & vbCrLf & "  - " & itm.Subject & ": " & itmErr
                    End If
                End If
                DoEvents
            End If
        End If
    Next i

    If matched = 0 Then
        MsgBox "Khong tim thay mail nao cua campaign '" & slug & "' trong Sent Items." & vbCrLf & _
               "(Chi cac campaign gui SAU khi cap nhat macro v" & VER & " moi duoc luu lai de recall.)", _
               vbExclamation, "SHB Tracker - Recall"
        Exit Sub
    End If

    Dim doneMsg As String
    doneMsg = "Hoan thanh Recall cho campaign '" & slug & "'!" & vbCrLf & _
              "Tim thay  : " & matched & vbCrLf & _
              "Da recall : " & recalled & vbCrLf & _
              "Loi       : " & failed & vbCrLf & vbCrLf & _
              "Luu y: Recall chi thanh cong voi nguoi nhan noi bo, dung Outlook Desktop, " & _
              "va chua doc mail - day la gioi han cua Exchange."
    If failed > 0 Then doneMsg = doneMsg & vbCrLf & vbCrLf & "Chi tiet loi:" & failDiag
    MsgBox doneMsg, vbInformation, "SHB Tracker - Recall"
End Sub


' ================================================================
' RECALL ONE ITEM
' "Recall This Message" la lenh Ribbon (Fluent UI), KHONG nam trong
' MailItem.Actions (do chi co Reply/ReplyAll/Forward...). Phai mo
' mail (Display) roi goi lenh Ribbon qua CommandBars.ExecuteMso, sau
' do tu dong xac nhan dialog bang SendKeys (Outlook Object Model
' khong co API recall khong-dialog). Mac dinh dialog chon san "Delete
' unread copies"; neu doReplace=True se Tab xuong chon "...and
' replace" roi Enter.
'
' Khi doReplace=True, sau khi xac nhan dialog Outlook se tu mo 1 cua
' so soan thu MOI (ban copy cua mail goc, editable) - ham nay lay
' cua so do qua ActiveInspector, ghi de Subject/HTMLBody bang noi
' dung thay the (da soan san day du dinh dang tu 1 mail khac), roi
' tu Send - khong can nguoi dung bam tay tung cai.
' ================================================================
Private Function RecallOneItem(itm As Object, doReplace As Boolean, _
                                Optional replSubject As String = "", _
                                Optional replHTML As String = "", _
                                Optional ByRef errMsg As String = "") As Boolean
    On Error GoTo Fail

    ' Mo mail can recall ra cua so rieng de co the goi lenh Ribbon "RecallThisMessage"
    itm.Display

    Dim tOpen As Date: tOpen = Now + TimeSerial(0, 0, 1)
    Do While Now < tOpen: DoEvents: Loop

    Dim readInsp As Object
    Set readInsp = Application.ActiveInspector
    If readInsp Is Nothing Then
        errMsg = "Khong mo duoc cua so mail can recall."
        GoTo FailNoErrObj
    End If

    On Error Resume Next
    readInsp.CommandBars.ExecuteMso "RecallThisMessage"
    Dim ExecErr As Long: ExecErr = Err.Number
    Dim ExecDesc As String: ExecDesc = Err.Description
    On Error GoTo Fail
    If ExecErr <> 0 Then
        On Error Resume Next
        readInsp.Close olDiscard
        On Error GoTo Fail
        errMsg = "ExecuteMso 'RecallThisMessage' loi #" & ExecErr & " " & ExecDesc & _
                 " (mail co the khong phai gui qua Exchange, hoac nguoi gui khong con quyen recall)."
        GoTo FailNoErrObj
    End If

    ' Cho dialog "Message Recall" xuat hien roi tu dong xac nhan
    Dim tEnd As Date: tEnd = Now + TimeSerial(0, 0, 1)
    Do While Now < tEnd: DoEvents: Loop

    If doReplace Then
        SendKeys "{TAB}{DOWN}", True
    End If
    SendKeys "~", True   ' Enter = OK

    Dim tEnd2 As Date: tEnd2 = Now + TimeSerial(0, 0, 1)
    Do While Now < tEnd2: DoEvents: Loop

    If doReplace Then
        ' Outlook vua mo cua so soan mail thay the - lay va gui no
        Dim tEnd3 As Date: tEnd3 = Now + TimeSerial(0, 0, 2)
        Do While Now < tEnd3: DoEvents: Loop

        Dim replInsp As Object
        Set replInsp = Application.ActiveInspector
        If Not replInsp Is Nothing Then
            Dim replMail As Object
            Set replMail = replInsp.CurrentItem
            If Not replMail Is Nothing Then
                If replMail.Class = olMail Then
                    replMail.Subject = replSubject
                    replMail.HTMLBody = replHTML
                    replMail.send
                End If
            End If
        End If
    End If

    On Error Resume Next
    readInsp.Close olDiscard
    On Error GoTo 0

    RecallOneItem = True
    Exit Function

Fail:
    errMsg = "#" & Err.Number & " " & Err.Description
    On Error Resume Next
    If Not readInsp Is Nothing Then readInsp.Close olDiscard
    On Error GoTo 0
FailNoErrObj:
    RecallOneItem = False
End Function


' ================================================================
' PUBLIC: CleanCampaignCopies
' ================================================================
Public Sub CleanCampaignCopies()
    Dim df As folder
    Set df = Application.Session.GetDefaultFolder(olFolderDrafts)
    Dim i As Long
    For i = df.Items.Count To 1 Step -1
        Dim itm As Object: Set itm = df.Items(i)
        If itm.Class = olMail Then
            If Left(Trim(itm.subject), 9) = "[CM-COPY]" Then itm.Delete
        End If
    Next i
    MsgBox "Da don dep ban copy cu.", vbInformation, "SHB Tracker v" & VER
End Sub
