ESX = nil

TriggerEvent('esx:getSharedObject', function(obj) 
    ESX = obj 
end)


RegisterServerEvent('phone:server:getCredentials')
AddEventHandler('phone:server:getCredentials', function()
    local _source = source
    local xPlayer = ESX.GetPlayerFromId(_source)
    local _identifier = xPlayer.getIdentifier()
    MySQL.Async.fetchAll('SELECT phone_number FROM users WHERE `identifier`=@identifier', 
    {
        ['@identifier'] = _identifier
    },  
        function(result)
            for k,v in pairs(result) do
                print(v.phone_number)
                number = v.phone_number
            end
            TriggerClientEvent('phone:client:sendCredentials', _source, number)
    end)
    TriggerClientEvent('phone:client:send', _source)
end)