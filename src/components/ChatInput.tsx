import React from "react";
import { RefObject, useEffect, useState } from "react";

interface ChatInputProps {
    messageInputRef: RefObject<HTMLTextAreaElement>,
    messageInputKeyDown: (e: any) => void,
}

const ChatInput: React.FC<ChatInputProps> = ({
    messageInputRef,
    messageInputKeyDown
}) => {
    const [suggestions, setSuggestions] = useState<Array<any>>([]);
    const [filteredSuggestions, setFilteredSuggestions] = useState<Array<any>>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [query, setQuery] = useState<string | null>("");

    useEffect(() => {
        //fetch("http://10.120.80.60:44200/ContentTemplate/GetAutoComplete")
        //    .then((res) => res.json())
        //    .then((data) => {
        //        console.log('xxxxx', data);
        //        setSuggestions(data);
        //    })
        //    .catch((error) => console.error("Error fetching suggestions:", error));
        const data = [{
            "Id": "27ee9a62-1e81-4b49-8cf2-bffaebd87a84", "Content": "Đơn hàng hàng tháng bao gồm các sản phẩm “Buổi Sáng Dinh Dưỡng” từ 1.500.000 VNĐ trở lên liên tục 3 tháng, vào tháng thứ 3 sẽ nhận được:\r\n01 Thực phẩm dùng cho chế độ ăn đặc biệt nutrilite™ all-plant protein powder (10g/gói, 1 hộp 18 gói)\r\n[quà độc quyền SOP]", "Keyword": "SOP297", "ReferenceObjectType": null, "ReferenceObjectId": "e752a8de-263e-4d54-8d17-1e3bd3b03cd7", "ReferenceObjectName": "Amway/Outbound", "IsPublic": true, "TotalCount": 3, "CreatedBy": "00000000-1111-2222-3333-444444444444", "CreatedDate": "/Date(1741676998533)/", "ModifiedBy": "00000000-1111-2222-3333-444444444444", "ModifiedDate": "/Date(1741677611717)/", "Deleted": false, "DeletedBy": null, "DeletedDate": null, "UrlGetTemplateParameter": null, "Type": 1
        }, {
            "Id": "cecc99b7-f530-40db-af86-32a36bc1c764", "Content": "Đơn hàng hàng tháng bao gồm các sản phẩm Artistry từ 2.000.000 VNĐ trở lên liên tục 3 tháng, vào tháng thứ 3 sẽ nhận được:\r\n\r\n01 Sữa rửa mặt làm sạch tế bào da chết Artistry Studio Cleanser+ Exfoliator\r\n01 Xịt khoáng bảo vệ da Artistry Studio Refresher+Protector Face Mist\r\n01 Mặt nạ cấp ẩm ARTISTRY Brightening Sheet Mask - 25ml X 5 miếng [quà độc quyền SOP]", "Keyword": "SOP859", "ReferenceObjectType": null, "ReferenceObjectId": "e752a8de-263e-4d54-8d17-1e3bd3b03cd7", "ReferenceObjectName": "Amway/Outbound", "IsPublic": true, "TotalCount": 3, "CreatedBy": "00000000-1111-2222-3333-444444444444", "CreatedDate": "/Date(1741677701017)/", "ModifiedBy": null, "ModifiedDate": null, "Deleted": false, "DeletedBy": null, "DeletedDate": null, "UrlGetTemplateParameter": null, "Type": 1
        }, {
            "Id": "5cfb266e-e9b5-4cb8-bfde-2344ff3f3218", "Content": "Đơn hàng hàng tháng bao gồm các sản phẩm Glister, G\u0026H, Santinique, Amway Home từ 1.000.000 VNĐ trở lên mỗi tháng liên tục 3 tháng, vào tháng thứ 3 sẽ nhận được:\r\n\r\n01 Nước rửa chén đậm đặc Dish Drops\r\n01 Kem đánh răng đa năng Glister Multi-Action Toothpaste", "Keyword": "SOP860", "ReferenceObjectType": null, "ReferenceObjectId": "e752a8de-263e-4d54-8d17-1e3bd3b03cd7", "ReferenceObjectName": "Amway/Outbound", "IsPublic": true, "TotalCount": 3, "CreatedBy": "00000000-1111-2222-3333-444444444444", "CreatedDate": "/Date(1741677723217)/", "ModifiedBy": "00000000-1111-2222-3333-444444444444", "ModifiedDate": "/Date(1741677757140)/", "Deleted": false, "DeletedBy": null, "DeletedDate": null, "UrlGetTemplateParameter": null, "Type": 3
        }];
        setSuggestions(data);
    }, []);

    const getHighlightedText = (text: string, highlight: string) => {
        const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
        return (
            <React.Fragment>
                {parts.map((part, index) => part.toLowerCase() === highlight.toLowerCase() ? (<mark key={index}>{part}</mark>) : (part))}
            </React.Fragment>
        );
    };

    const handleKeyUp = (e: any) => {
        if (messageInputRef.current?.value?.startsWith("::") === true) {
            const _query = e.target.value.slice(2).toLowerCase();
            setQuery(_query);
            const matches = suggestions.filter((s: any) => s.Content.toLowerCase().indexOf(_query) >= 0);
            setFilteredSuggestions(matches);
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };

    const handleSelectSuggestion = (suggestion: any) => {
        if (messageInputRef.current) {
            messageInputRef.current.value = suggestion.Content;
        }
        setShowSuggestions(false);

        setTimeout(() => {
            messageInputRef.current?.focus();
        }, 0);
    };

    return (
        <React.Fragment>
            <textarea onKeyUp={handleKeyUp} ref={messageInputRef} onKeyDown={messageInputKeyDown} className="message-input" placeholder="Type a message..." id="messageInput"></textarea>
            {showSuggestions && (
                <ul style={{ 
                    position: 'absolute', 
                    top: '0',
                    transform: 'translateY(calc(-100% - 10px))',
                    maxWidth: '550px',
                    left: '0', 
                    right: '0', 
                    backgroundColor: 'white', 
                    border: '1px solid #ccc', 
                    zIndex: 1, 
                    listStyleType: 'none', 
                    padding: 0,
                    fontSize: 13,
                    overflow: 'auto'
                }}>
                    {filteredSuggestions.length ? (
                    filteredSuggestions.map((suggestion, index) => (
                        <li className="suggestion-item" key={index} onClick={() => handleSelectSuggestion(suggestion)} style={{
                            padding: '10px',
                            cursor: 'pointer',
                            backgroundColor: index % 2 === 0 ? 'rgb(253, 253, 253)' : 'rgb(247, 247, 247)',
                        }}>{getHighlightedText(suggestion.Content, query ?? '')}</li>
                    ))
                    ) : (
                        <li style={{ padding: '8px' }}>No suggestions</li>
                    )}
                </ul>
            )}
        </React.Fragment>
    );
}

export default ChatInput;